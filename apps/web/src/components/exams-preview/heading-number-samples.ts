// Student-visible excerpts. Section membership and activity/item numbers are explicitly authored.
// Full authoring bundles and private answers never enter the browser.
type HeadingNumberSample = {
  id: string
  category: 'VOCABULARY' | 'GRAMMAR' | null
  title: string | null
  label: string
  source: string
  activities: readonly {
    id: string
    number: string
    instruction: string
    questions: readonly { id: string; label: string; navigationLabel: string; prompt: string }[]
  }[]
}
export const HEADING_NUMBER_SAMPLES: readonly HeadingNumberSample[] = [
  {
    "id": "people",
    "category": "VOCABULARY",
    "title": "DESCRIBING PEOPLE",
    "label": "VOCABULARY: DESCRIBING PEOPLE",
    "source": "听力训练 · PDF 第29页",
    "activities": [
      {
        "id": "exercise-1",
        "number": "1",
        "instruction": "Who do these words describe? Write T (Tom), A (Axel) or N (Niko).",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:1-example",
            "label": "例题",
            "navigationLabel": "练习 1 · 例题",
            "prompt": "tall — T."
          },
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:1-1",
            "label": "第 1 题",
            "navigationLabel": "练习 1 · 第 1 题",
            "prompt": "blonde"
          }
        ]
      },
      {
        "id": "exercise-2",
        "number": "2",
        "instruction": "Who is the woman describing? Listen and choose the correct picture in Exercise 1.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:2",
            "label": "题目",
            "navigationLabel": "练习 2 · 题目",
            "prompt": "Who is the woman describing? Listen and choose the correct picture in Exercise 1."
          }
        ]
      }
    ]
  },
  {
    "id": "home",
    "category": "VOCABULARY",
    "title": "PARTS OF THE HOME",
    "label": "VOCABULARY: PARTS OF THE HOME",
    "source": "听力训练 · PDF 第29页",
    "activities": [
      {
        "id": "exercise-3",
        "number": "3",
        "instruction": "Label the pictures with words from the box.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:3-example",
            "label": "例题",
            "navigationLabel": "练习 3 · 例题",
            "prompt": "lamp."
          },
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:3-1",
            "label": "第 1 题",
            "navigationLabel": "练习 3 · 第 1 题",
            "prompt": "Label picture number 1 with a word from the box."
          }
        ]
      },
      {
        "id": "exercise-4",
        "number": "4",
        "instruction": "Look at the pictures in Exercise 3. If the sentence is right, put a tick (✓). If it is wrong, put a cross (✗).",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:4-example",
            "label": "例题",
            "navigationLabel": "练习 4 · 例题",
            "prompt": "The lamp is on the table next to the bed. ✓"
          },
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:4-1",
            "label": "第 1 题",
            "navigationLabel": "练习 4 · 第 1 题",
            "prompt": "The pillow is under the bed."
          }
        ]
      }
    ]
  },
  {
    "id": "future",
    "category": "GRAMMAR",
    "title": "FUTURE FORMS",
    "label": "GRAMMAR: FUTURE FORMS",
    "source": "听力训练 · PDF 第30页",
    "activities": [
      {
        "id": "exercise-5",
        "number": "5",
        "instruction": "Listen to the sentences and decide if they are about the present or the future. Write P (present) or F (future).",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:5-example",
            "label": "例题",
            "navigationLabel": "练习 5 · 例题",
            "prompt": "P."
          },
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:5-1",
            "label": "第 1 题",
            "navigationLabel": "练习 5 · 第 1 题",
            "prompt": "Sentence 1: write P (present) or F (future)."
          }
        ]
      },
      {
        "id": "exercise-6",
        "number": "6",
        "instruction": "When are they going to play tennis? Listen and choose the correct picture.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:6",
            "label": "题目",
            "navigationLabel": "练习 6 · 题目",
            "prompt": "When are they going to play tennis? Listen and choose the correct picture."
          }
        ]
      }
    ]
  },
  {
    "id": "suggestions",
    "category": "VOCABULARY",
    "title": "SUGGESTIONS",
    "label": "VOCABULARY: SUGGESTIONS",
    "source": "听力训练 · PDF 第30页",
    "activities": [
      {
        "id": "exercise-7",
        "number": "7",
        "instruction": "Match each suggestion with two possible replies.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:7-example",
            "label": "例题",
            "navigationLabel": "练习 7 · 例题",
            "prompt": "Let’s go to the park."
          },
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:7-1",
            "label": "第 1 题",
            "navigationLabel": "练习 7 · 第 1 题",
            "prompt": "What about having a chocolate cake?"
          }
        ]
      },
      {
        "id": "exercise-8",
        "number": "8",
        "instruction": "Is each reply in Exercise 7 used to agree or disagree with the suggestion? Write A (agree) or D (disagree) next to each reply.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:8-1",
            "label": "第 1 题",
            "navigationLabel": "练习 8 · 第 1 题",
            "prompt": "No, let’s drive."
          },
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:8-2",
            "label": "第 2 题",
            "navigationLabel": "练习 8 · 第 2 题",
            "prompt": "I would prefer coffee."
          }
        ]
      },
      {
        "id": "exercise-9",
        "number": "9",
        "instruction": "Where do they agree to have coffee? Listen and choose the correct picture.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:listening:part-1:9",
            "label": "题目",
            "navigationLabel": "练习 9 · 题目",
            "prompt": "Where do they agree to have coffee? Listen and choose the correct picture."
          }
        ]
      }
    ]
  },
  {
    "id": "modals",
    "category": "GRAMMAR",
    "title": "MODAL VERBS",
    "label": "GRAMMAR: MODAL VERBS",
    "source": "阅读训练 · PDF 第12页",
    "activities": [
      {
        "id": "exercise-4",
        "number": "4",
        "instruction": "Read the notices. Complete the sentences with words from the box.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:reading_writing:part-1:4-example",
            "label": "例题",
            "navigationLabel": "练习 4 · 例题",
            "prompt": "No credit cards under £5. You can’t use a credit card if you spend less than £5."
          },
          {
            "id": "ket-trainer-1:test-1:training:reading_writing:part-1:4-1",
            "label": "第 1 题",
            "navigationLabel": "练习 4 · 第 1 题",
            "prompt": "Free entry for under 8s.\nYounger children don’t ______ to pay."
          }
        ]
      }
    ]
  },
  {
    "id": "plain",
    "category": null,
    "title": null,
    "label": "无栏目标题 · 阅读练习",
    "source": "阅读训练 · PDF 第11–12页",
    "activities": [
      {
        "id": "exercise-1",
        "number": "1",
        "instruction": "Look at the pairs of words and phrases. Write S for those with similar meanings and D for those with different meanings.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:reading_writing:part-1:1-example",
            "label": "例题",
            "navigationLabel": "练习 1 · 例题",
            "prompt": "entrance / door — S."
          },
          {
            "id": "ket-trainer-1:test-1:training:reading_writing:part-1:1-1",
            "label": "第 1 题",
            "navigationLabel": "练习 1 · 第 1 题",
            "prompt": "on foot / walk"
          }
        ]
      },
      {
        "id": "exercise-2",
        "number": "2",
        "instruction": "Now complete the sentences with some of the words from Exercise 1.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:reading_writing:part-1:2-example",
            "label": "例题",
            "navigationLabel": "练习 2 · 例题",
            "prompt": "We got lost in the forest. There are so many trees!"
          },
          {
            "id": "ket-trainer-1:test-1:training:reading_writing:part-1:2-1",
            "label": "第 1 题",
            "navigationLabel": "练习 2 · 第 1 题",
            "prompt": "Summer ______ 3 pm in Arnos Park. Bring your own food!"
          }
        ]
      },
      {
        "id": "exercise-3",
        "number": "3",
        "instruction": "Who CANNOT do each activity? Use two words from the box for each notice.",
        "questions": [
          {
            "id": "ket-trainer-1:test-1:training:reading_writing:part-1:3-example",
            "label": "例题",
            "navigationLabel": "练习 3 · 例题",
            "prompt": "This film is for adults only. children and teenagers."
          },
          {
            "id": "ket-trainer-1:test-1:training:reading_writing:part-1:3-1",
            "label": "第 1 题",
            "navigationLabel": "练习 3 · 第 1 题",
            "prompt": "Play area for under 8s only. ______ and ______"
          }
        ]
      }
    ]
  }
]
