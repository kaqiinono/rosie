import type { CellCoord, HLineCoord, IneqCoord, VLineCoord } from "./types";

export const shulianExamples = {
    example1: {
        rows: [5] as [number],
        cells: [
            [1, 1, 3],
            [1, 3, 2],
            [2, 1, 1],
            [2, 3, 2],
            [3, 5, 3],
            [4, 2, 4],
            [5, 4, 1],
            [5, 5, 4],
        ] as CellCoord[],
    },
    example2: {
        rows: [5] as [number],
        cells: [
            [1, 1, 1],
            [1, 2, 2],
            [1, 3, 3],
            [2, 4, 4],
            [3, 2, 4],
            [3, 3, 2],
            [5, 3, 1],
            [5, 4, 3],
        ] as CellCoord[],
    },
};

export const shufangExamples = {
    example1: {
        rows: [5] as [number],
        cells: [
            [1, 2, 3],
            [2, 3, 2],
            [2, 5, 2],
            [3, 1, 5],
            [3, 3, 3],
            [3, 4, 3],
            [3, 5, 3],
            [4, 2, 4],
        ] as CellCoord[],
    },
};

export const shuqiaoExamples = {
    example1: {
        rows: [5] as [number],
        cells: [
            [1, 1, 2],
            [1, 3, 3],
            [1, 5, 1],
            [2, 2, 4],
            [2, 4, 2],
            [3, 3, 4],
            [3, 5, 2],
            [4, 2, 1],
            [5, 1, 3],
            [5, 3, 8],
            [5, 5, 2],
        ] as CellCoord[],
    },
    example2: {
        rows: [5] as [number],
        cells: [
            [1, 2, 3],
            [1, 5, 4],
            [2, 1, 1],
            [2, 3, 3],
            [2, 4, 3],
            [3, 2, 2],
            [4, 1, 3],
            [4, 4, 3],
            [4, 5, 3],
            [5, 2, 2],
            [5, 3, 2],
            [5, 5, 3],
        ] as CellCoord[],
    },
};

export const budengExamples = {
    example1: {
        rows: [4] as [number],
        hIneq: [
            [1, 2, "<"],
            [1, 3, "<"],
            [2, 3, ">"],
            [4, 3, ">"],
        ] as IneqCoord[],
        vIneq: [[1, 3, ">"]] as IneqCoord[],
        cells: [] as CellCoord[],
    },
    example2: {
        rows: [4] as [number],
        hIneq: [
            [1, 2, "<"],
            [2, 2, "<"],
        ] as IneqCoord[],
        vIneq: [
            [3, 4, ">"],
            [4, 3, ">"],
        ] as IneqCoord[],
        cells: [] as CellCoord[],
    },
    example3x3: {
        rows: [3] as [number],
        hIneq: [[1, 2, "<"], [2, 3, ">"]] as IneqCoord[],
        vIneq: [[1, 3, "<"]] as IneqCoord[],
        cells: [[2, 1, 2]] as CellCoord[],
    },
};

export const wumaExample = {
    rows: [6] as [number],
    cells: [
        [1, 1, 1],
        [1, 2, 2],
        [1, 3, 3],
        [1, 4, 6],
        [1, 5, 5],
        [1, 6, 4],
        [2, 1, 4],
        [2, 2, 5],
        [2, 3, 6],
        [2, 4, 3],
        [2, 5, 2],
        [3, 1, 5],
        [3, 2, 6],
        [3, 5, 3],
        [3, 6, 2],
        [4, 1, 2],
        [4, 2, 3],
        [4, 5, 6],
        [4, 6, 5],
        [5, 1, 3],
        [5, 3, 5],
        [5, 4, 2],
        [5, 6, 6],
        [6, 1, 6],
        [6, 3, 2],
        [6, 4, 5],
        [6, 6, 3],
    ] as CellCoord[],
};

export const chuangkouExample = {
    rows: [9] as [number],
    cells: [
        [1, 4, 3],
        [1, 5, 5],
        [1, 6, 7],
        [2, 2, 4],
        [2, 3, 7],
        [2, 7, 5],
        [2, 8, 8],
        [3, 2, 3],
        [3, 3, 6],
        [3, 7, 2],
        [3, 8, 7],
        [4, 1, 4],
        [4, 5, 7],
        [4, 9, 6],
        [5, 1, 8],
        [5, 4, 6],
        [5, 6, 5],
        [5, 9, 4],
        [6, 1, 1],
        [6, 5, 9],
        [6, 9, 8],
        [7, 2, 8],
        [7, 3, 2],
        [7, 7, 9],
        [7, 8, 4],
        [8, 2, 9],
        [8, 3, 1],
        [8, 7, 6],
        [8, 8, 3],
        [9, 4, 2],
        [9, 5, 6],
        [9, 6, 9],
    ] as CellCoord[],
};

export const changguiExamples = {
    example4x4: {
        rows: [4] as [number],
        cells: [
            [1, 1, 3],
            [1, 4, 4],
            [2, 4, 3],
            [3, 3, 4],
            [4, 2, 2],
            [4, 3, 3],
        ] as CellCoord[],
    },
};


// <DuijiaoxianSudokuGrid
//     rows={[6]}
// cells={[
//       [1, 2, 5],
//   [2, 4, 5],
// [3, 2, 1],
//     [3, 6, 2],
//     [4, 1, 4],
//     [4, 2, 3],
//     [4, 6, 1],
//     [5, 2, 6],
//     [5, 3, 1],
//     [5, 5, 2],
//     [5, 6, 5],
//     [6, 3, 4],
//     [6, 4, 1],
//     [6, 5, 6],
// ]}
// />
export const duijiaoxianExamples = {
    example6x6: {
        rows: [6] as [number],
        cells: [
            [1, 2, 5],
            [2, 4, 5],
            [3, 2, 1],
            [3, 6, 2],
            [4, 1, 4],
            [4, 2, 3],
            [5, 2, 6],
            [5, 5, 2],
            [6, 3, 4],
            [6, 4, 1],
            [6, 5, 6],
        ] as CellCoord[],
    },
};

export const juchiExamples = {
    example6x6: {
        rows: [6] as [number],
        cells: [
            [1, 1, 6],
            [1, 3, 5],
            [1, 5, 3],
            [1, 6, 4],
            [2, 2, 2],
            [2, 5, 5],
            [3, 2, 5],
            [3, 3, 1],
            [3, 6, 3],
            [4, 1, 4],
            [4, 4, 5],
            [4, 5, 1],
            [5, 2, 6],
            [5, 3, 1],
            [5, 5, 2],
            [5, 6, 5],
            [6, 1, 5],
            [6, 3, 3],
            [6, 4, 1],
            [6, 5, 2],
        ] as CellCoord[],
        hLine: [
            [1, 3],
            [1, 5],
            [2, 3],
            [2, 5],
            [3, 2],
            [3, 4],
            [3, 5],
            [3, 6],
            [4, 2],
            [4, 4],
            [4, 5],
            [4, 6],
            [5, 3],
            [5, 5],
            [6, 3],
            [6, 5],
        ] satisfies HLineCoord[],
        vLine: [
            [1, 5],
            [2, 3],
            [2, 4],
            [3, 4],
            [3, 5],
            [4, 3],
            [5, 3],
            [6, 5],
        ] satisfies VLineCoord[],
    },
};
