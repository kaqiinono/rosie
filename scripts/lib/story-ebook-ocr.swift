import Foundation
import Vision

struct Line: Encodable {
    let text: String
    let alternate: String?
    let confidence: Float
    let x: Double
    let y: Double
    let w: Double
    let h: Double
}

let paths = CommandLine.arguments.dropFirst().map { URL(fileURLWithPath: $0, isDirectory: true) }
let jobs = OperationQueue()
jobs.maxConcurrentOperationCount = 4
let state = NSLock()
var errors = 0

for volume in paths {
    let input = volume.appendingPathComponent("pages", isDirectory: true)
    let output = volume.appendingPathComponent("ocr", isDirectory: true)
    try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
    for page in try FileManager.default.contentsOfDirectory(at: input, includingPropertiesForKeys: nil)
        .sorted(by: { $0.path < $1.path })
        where ["jpg", "png"].contains(page.pathExtension) {
        let destination = output.appendingPathComponent(page.deletingPathExtension().lastPathComponent + ".json")
        if FileManager.default.fileExists(atPath: destination.path) { continue }
        jobs.addOperation {
            do {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.recognitionLanguages = ["en-US"]
                request.usesLanguageCorrection = true
                try VNImageRequestHandler(url: page).perform([request])
                let lines = (request.results ?? []).compactMap { observation -> Line? in
                    let candidates = observation.topCandidates(2)
                    guard let first = candidates.first else { return nil }
                    let box = observation.boundingBox
                    return Line(text: first.string, alternate: candidates.dropFirst().first?.string,
                                confidence: first.confidence, x: box.minX, y: 1 - box.maxY,
                                w: box.width, h: box.height)
                }
                try JSONEncoder().encode(lines).write(to: destination, options: .atomic)
            } catch {
                state.lock()
                errors += 1
                state.unlock()
                FileHandle.standardError.write(Data(("\(volume.lastPathComponent)/\(page.lastPathComponent): \(error)\n").utf8))
            }
        }
    }
}
jobs.waitUntilAllOperationsAreFinished()
print("Story OCR complete. Failed pages: \(errors)")
exit(errors == 0 ? 0 : 1)
