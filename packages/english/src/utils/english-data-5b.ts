import type { WordEntry } from '@rosie/core'

/**
 * 5B vocabulary backup — 262 entries across Units 7–12 (260 distinct words).
 * Generated 2026-11-13 from 厚少五下 单词卡片.pdf (all 50 pages).
 * Approved source corrections: stretch → strength; precent → percent;
 * Extesion → Extension. Wrapped text is joined; bacteria uses the complete
 * definition preserved in the PDF text layer.
 * Supabase word_entries is canonical; this backup is used by /admin/word-audit.
 * Manual import: scripts/tmp/5b-upsert.sql, then scripts/tmp/5b-update-maps.sql.
 */
const _RAW_WORDS_5B: WordEntry[] = [
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "stress",
    "explanation": "pressure or worry caused by problems in somebody’s life or by having too much to do",
    "vocabType": "Target",
    "ipa": "/stres/",
    "example": "Too much homework can cause stress for children.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "breathe",
    "explanation": "to take air into your lungs and send it out again through your nose or mouth",
    "vocabType": "Context",
    "ipa": "/briːð/",
    "example": "Breathe slowly through your nose before the school race.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "comfortable",
    "explanation": "feeling relaxed and happy",
    "vocabType": "Context",
    "ipa": "/ˈkʌmftəbl/",
    "example": "I feel comfortable with my friends at school.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more comfortable"
      ],
      "superlative": [
        "most comfortable"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "diet",
    "explanation": "the food and drink that you eat and drink regularly",
    "vocabType": "Context",
    "ipa": "/ˈdaɪət/",
    "example": "Fruit and vegetables are part of a healthy diet.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "fit",
    "explanation": "healthy and strong, especially because you do regular physical exercise",
    "vocabType": "Context",
    "ipa": "/fɪt/",
    "example": "We stay fit by swimming and playing outside.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "fitter"
      ],
      "superlative": [
        "fittest"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "mind",
    "explanation": "a person's attention",
    "vocabType": "Context",
    "ipa": "/maɪnd/",
    "example": "Keep your mind on the story while I read.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "emotional",
    "explanation": "connected with people’s feelings",
    "vocabType": "Target",
    "ipa": "/ɪˈməʊʃənl/",
    "example": "Our teacher cares about our emotional needs at school.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "energetic",
    "explanation": "having or showing a lot of energy",
    "vocabType": "Target",
    "ipa": "/ˌenəˈdʒetɪk/",
    "example": "Our energetic puppy runs around the garden all morning.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more energetic"
      ],
      "superlative": [
        "most energetic"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "muscle",
    "explanation": "a body tissue that can contract and produce movement",
    "vocabType": "Target",
    "ipa": "/ˈmʌsl/",
    "example": "The muscles in your legs help you jump.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "physical",
    "explanation": "connected with a person’s body rather than their mind",
    "vocabType": "Target",
    "ipa": "/ˈfɪzɪkl/",
    "example": "Running and jumping are good for our physical health.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "sense",
    "explanation": "one of the five powers (sight, hearing, smell, taste and touch) that your body uses to get information about the world around you",
    "vocabType": "Target",
    "ipa": "/sens/",
    "example": "Dogs use their sense of smell to find food.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "sore",
    "explanation": "feeling or affected by pain",
    "vocabType": "Target",
    "ipa": "/sɔː/",
    "example": "My legs feel sore after our long walk.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "stream",
    "explanation": "a small, narrow river",
    "vocabType": "Extension",
    "ipa": "/striːm/",
    "example": "We watched tiny fish swimming in the clear stream.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "pain",
    "explanation": "the feelings that you have in your body when you have been hurt or when you are ill",
    "vocabType": "Context",
    "ipa": "/peɪn/",
    "example": "I felt pain in my knee after falling.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "tense",
    "explanation": "nervous and not able to relax",
    "vocabType": "Context",
    "ipa": "/tens/",
    "example": "I felt tense before singing in front of everyone.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "sprinter",
    "explanation": "a person who runs very fast over a short distance in a race",
    "vocabType": "Extension",
    "ipa": "/ˈsprɪntə/",
    "example": "The young sprinter won the short race at school.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "disability",
    "explanation": "a physical or mental condition that makes it difficult for somebody to do some things that most other people can do",
    "vocabType": "Extension",
    "ipa": "/ˌdɪsəˈbɪləti/",
    "example": "Her disability makes climbing stairs difficult, so she uses the lift.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "stroke",
    "explanation": "to move your hand gently and slowly over an animal’s fur or hair",
    "vocabType": "Extension",
    "ipa": "/strəʊk/",
    "example": "Please stroke the rabbit gently with one hand.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 1",
    "word": "scented",
    "explanation": "having a strong pleasant smell",
    "vocabType": "Extension",
    "ipa": "/ˈsentɪd/",
    "example": "The scented flowers filled our room with a lovely smell.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "active",
    "explanation": "always busy doing things, especially physical activities",
    "vocabType": "Target",
    "ipa": "/ˈæktɪv/",
    "example": "My active sister loves running, dancing, and playing outside.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more active"
      ],
      "superlative": [
        "most active"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "anxious",
    "explanation": "feeling worried or nervous",
    "vocabType": "Target",
    "ipa": "/ˈæŋkʃəs/",
    "example": "I felt anxious when my kitten went missing.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more anxious"
      ],
      "superlative": [
        "most anxious"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "brain",
    "explanation": "the organ inside the head that controls movement, thought, memory and feeling",
    "vocabType": "Target",
    "ipa": "/breɪn/",
    "example": "Your brain helps you think, move, and remember things.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "depressed",
    "explanation": "very sad and without hope",
    "vocabType": "Target",
    "ipa": "/dɪˈprest/",
    "example": "He felt depressed and believed nothing would ever get better.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more depressed"
      ],
      "superlative": [
        "most depressed"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "memory",
    "explanation": "your ability to remember things",
    "vocabType": "Target",
    "ipa": "/ˈmeməri/",
    "example": "My grandmother has a good memory for our birthdays.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "produce",
    "explanation": "to cause a particular result or effect",
    "vocabType": "Context",
    "ipa": "/prəˈdjuːs/",
    "example": "Rubbing the balloon on my hair can produce static electricity.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "satisfied",
    "explanation": "having a happy or pleased feeling because of something that you did or something that happened to you",
    "vocabType": "Context",
    "ipa": "/ˈsætɪsfaɪd/",
    "example": "I felt satisfied after finishing my difficult puzzle.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more satisfied"
      ],
      "superlative": [
        "most satisfied"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "suffer",
    "explanation": "to experience pain, illness, or injury",
    "vocabType": "Context",
    "ipa": "/ˈsʌfə/",
    "example": "Some children suffer from ear infections during winter.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "cell",
    "explanation": "the smallest unit of living matter that can exist on its own. All plants and animals are made up of cells.",
    "vocabType": "Extension",
    "ipa": "/sel/",
    "example": "We looked at a plant cell under the microscope.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "bring out",
    "explanation": "to produce something",
    "vocabType": "Extension",
    "ipa": "/brɪŋ aʊt/",
    "example": "Our class will bring out a new comic next week.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "thirdPerson": [
        "brings out"
      ],
      "presentParticiple": [
        "bringing out"
      ],
      "past": [
        "brought out"
      ],
      "pastParticiple": [
        "brought out"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "catch on",
    "explanation": "to become popular or fashionable",
    "vocabType": "Extension",
    "ipa": "/kætʃ ɒn/",
    "example": "This new playground game will catch on very quickly.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "thirdPerson": [
        "catches on"
      ],
      "presentParticiple": [
        "catching on"
      ],
      "past": [
        "caught on"
      ],
      "pastParticiple": [
        "caught on"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "mood",
    "explanation": "the way you are feeling at a particular time",
    "vocabType": "Target",
    "ipa": "/muːd/",
    "example": "The sunny morning put me in a happy mood.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "self-confident",
    "explanation": "having confidence in yourself and your abilities",
    "vocabType": "Target",
    "ipa": "/ˌself ˈkɒnfɪdənt/",
    "example": "The self-confident girl happily showed everyone her new dance.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more self-confident"
      ],
      "superlative": [
        "most self-confident"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "belong",
    "explanation": "to be in the right or suitable place",
    "vocabType": "Context",
    "ipa": "/bɪˈlɒŋ/",
    "example": "These library books belong on the top shelf.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "benefit",
    "explanation": "a good or helpful result or effect",
    "vocabType": "Context",
    "ipa": "/ˈbenɪfɪt/",
    "example": "Better sleep is one benefit of playing outside.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "negative",
    "explanation": "bad or harmful",
    "vocabType": "Context",
    "ipa": "/ˈneɡətɪv/",
    "example": "Too much screen time can have negative effects on sleep.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more negative"
      ],
      "superlative": [
        "most negative"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 2",
    "word": "positive",
    "explanation": "good or useful",
    "vocabType": "Context",
    "ipa": "/ˈpɒzətɪv/",
    "example": "Helping each other has a positive effect on our class.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more positive"
      ],
      "superlative": [
        "most positive"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 3",
    "word": "exhausted",
    "explanation": "very tired",
    "vocabType": "Extension",
    "ipa": "/ɪɡˈzɔːstɪd/",
    "example": "We felt exhausted after walking up the big hill.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 3",
    "word": "upset",
    "explanation": "unhappy or disappointed because of something unpleasant that has happened",
    "vocabType": "Extension",
    "ipa": "/ʌpˈset/",
    "example": "I was upset when my favourite toy broke.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more upset"
      ],
      "superlative": [
        "most upset"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 3",
    "word": "text",
    "explanation": "to send somebody a written message using a mobile phone",
    "vocabType": "Extension",
    "ipa": "/tekst/",
    "example": "Please text Mum when we arrive at the park.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 7",
    "lesson": "Lesson 3",
    "word": "vitamin",
    "explanation": "A natural substance found in food that is an essential part of what humans and animals need to help them grow and stay healthy. There are many different vitamins.",
    "vocabType": "Extension",
    "ipa": "/ˈvɪtəmɪn/",
    "example": "Oranges contain vitamin C, which helps us stay healthy.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "sophisticated",
    "explanation": "highly developed and complex",
    "vocabType": "Target",
    "ipa": "/səˈfɪstɪkeɪtɪd/",
    "example": "Our school robot uses a sophisticated system to sort toys.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "comparative": [
        "more sophisticated"
      ],
      "superlative": [
        "most sophisticated"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "copy",
    "explanation": "something that is or looks exactly or almost exactly like something else, especially a document or a work of art",
    "vocabType": "Context",
    "ipa": "/ˈkɒpi/",
    "example": "This picture is a copy of my sister's painting.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "exhibition",
    "explanation": "a collection of things, for example works of art, that are shown to the public",
    "vocabType": "Context",
    "ipa": "/ˌeksɪˈbɪʃn/",
    "example": "We saw an exhibition of children's paintings at school.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "graffiti",
    "explanation": "drawings or writing on a wall, etc. in a public place",
    "vocabType": "Context",
    "ipa": "/ɡrəˈfiːti/",
    "example": "There was colourful graffiti on the wall near our school.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "landscape",
    "explanation": "a painting of a view of the countryside; this style of painting",
    "vocabType": "Context",
    "ipa": "/ˈlændskeɪp/",
    "example": "Grandma painted a landscape with fields and a small river.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "original",
    "explanation": "a document, work of art, etc. produced for the first time, from which copies are later made",
    "vocabType": "Context",
    "ipa": "/əˈrɪdʒənl/",
    "example": "This painting is the original, and that one is a copy.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "abandoned",
    "explanation": "left and no longer wanted, used or needed",
    "vocabType": "Target",
    "ipa": "/əˈbændənd/",
    "example": "We saw an abandoned house with broken windows.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "community",
    "explanation": "a group of people who live in the same area (such as a city, town, or neighborhood)",
    "vocabType": "Target",
    "ipa": "/kəˈmjuːnəti/",
    "example": "Our community planted flowers together in the park.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "dull",
    "explanation": "not exciting or interesting",
    "vocabType": "Target",
    "ipa": "/dʌl/",
    "example": "The film was dull, so my brother fell asleep.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "mural",
    "explanation": "a usually large painting that is done directly on the surface of a wall",
    "vocabType": "Target",
    "ipa": "/ˈmjʊərəl/",
    "example": "Our class painted a bright mural on the playground wall.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "permission",
    "explanation": "the right or ability to do something that is given by someone who has the power to decide if it will be allowed or permitted",
    "vocabType": "Target",
    "ipa": "/pəˈmɪʃn/",
    "example": "I asked Dad for permission to invite my friends.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "public",
    "explanation": "able to be used by anyone",
    "vocabType": "Target",
    "ipa": "/ˈpʌblɪk/",
    "example": "We read our books in the public library.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "pipe",
    "explanation": "a tube through which liquids and gases can flow",
    "vocabType": "Extension",
    "ipa": "/paɪp/",
    "example": "Water flows through a pipe under our kitchen sink.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "urban",
    "explanation": "connected with a town or city",
    "vocabType": "Extension",
    "ipa": "/ˈɜːbən/",
    "example": "Urban foxes sometimes visit gardens in our city.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "aim",
    "explanation": "to have a specified goal or purpose",
    "vocabType": "Extension",
    "ipa": "/eɪm/",
    "example": "We aim to read one new book each week.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "portrait",
    "explanation": "a painting, drawing or photograph of a person, especially of the head and shoulders",
    "vocabType": "Context",
    "ipa": "/ˈpɔːtreɪt/",
    "example": "I drew a portrait of Mum for her birthday.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "scene",
    "explanation": "a painting, drawing, or photograph of a place and the things that are happening there",
    "vocabType": "Context",
    "ipa": "/siːn/",
    "example": "I painted a beach scene with children building sandcastles.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "alley",
    "explanation": "a narrow passage behind or between buildings",
    "vocabType": "Extension",
    "ipa": "/ˈæli/",
    "example": "A small alley runs between the bakery and our house.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "decorate",
    "explanation": "to make something look more attractive by putting things on it",
    "vocabType": "Extension",
    "ipa": "/ˈdekəreɪt/",
    "example": "We decorate our classroom with paper flowers every spring.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "limit to",
    "explanation": "to make something exist or happen only in a particular place or within a particular group",
    "vocabType": "Extension",
    "ipa": "/ˈlɪmɪt tə/",
    "example": "The art contest is limited to local children.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "limits to"
      ],
      "presentParticiple": [
        "limiting to"
      ],
      "past": [
        "limited to"
      ],
      "pastParticiple": [
        "limited to"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 1",
    "word": "individual",
    "explanation": "a person considered separately rather than as part of a group",
    "vocabType": "Extension",
    "ipa": "/ˌɪndɪˈvɪdʒuəl/",
    "example": "Each individual in our class chose a different book.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "donate",
    "explanation": "to give (money, food, clothes, etc.) in order to help a person or organization",
    "vocabType": "Target",
    "ipa": "/dəʊˈneɪt/",
    "example": "We donate warm coats to families who need them.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "motivate",
    "explanation": "to give (someone) a reason for doing something",
    "vocabType": "Target",
    "ipa": "/ˈməʊtɪveɪt/",
    "example": "My teacher's kind words motivate me to keep practising.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "opportunity",
    "explanation": "a time when a particular situation makes it possible to do or achieve something",
    "vocabType": "Target",
    "ipa": "/ˌɒpəˈtjuːnəti/",
    "example": "Our school play gave me an opportunity to sing.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "instrument",
    "explanation": "an object used for producing musical sounds, for example a piano or a drum",
    "vocabType": "Context",
    "ipa": "/ˈɪnstrəmənt/",
    "example": "My favourite musical instrument is the little wooden drum.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "orchestra",
    "explanation": "a large group of people who play various musical instruments together, led by a conductor",
    "vocabType": "Context",
    "ipa": "/ˈɔːkɪstrə/",
    "example": "The orchestra played beautiful music at our school concert.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "perform",
    "explanation": "to entertain an audience by playing a piece of music, acting in a play, etc.",
    "vocabType": "Context",
    "ipa": "/pəˈfɔːm/",
    "example": "Our class will perform a short play for our parents.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "saxophone",
    "explanation": "a metal musical instrument that you play by blowing into it and pressing keys to produce different notes",
    "vocabType": "Context",
    "ipa": "/ˈsæksəfəʊn/",
    "example": "My brother plays the saxophone in the school band.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "tune",
    "explanation": "a series of musical notes that are sung or played in a particular order to form a piece of music",
    "vocabType": "Context",
    "ipa": "/tjuːn/",
    "example": "Grandma sang a cheerful tune while baking our cake.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "violin",
    "explanation": "a musical instrument that has four strings and that you usually hold against your shoulder under your chin and play with a bow",
    "vocabType": "Context",
    "ipa": "/ˌvaɪəˈlɪn/",
    "example": "I practise the violin with my teacher every Friday.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "proud",
    "explanation": "feeling very pleased about something you have done, something you own, or someone you know",
    "vocabType": "Target",
    "ipa": "/praʊd/",
    "example": "Dad felt proud when I learned to swim.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "resident",
    "explanation": "a person who lives in a particular place or who has their home there",
    "vocabType": "Target",
    "ipa": "/ˈrezɪdənt/",
    "example": "Every resident of our village was invited to the picnic.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "resource",
    "explanation": "a supply of something that a country, an organisation or a person has and can use, especially to increase their wealth",
    "vocabType": "Target",
    "ipa": "/rɪˈsɔːs/",
    "example": "Clean water is a precious resource that we must save.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "run out (of)",
    "explanation": "to use up or finish a supply of something",
    "vocabType": "Target",
    "ipa": "/rʌn ˈaʊt (əv)/",
    "example": "We ran out of paper while making birthday cards.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "runs out",
        "runs out of"
      ],
      "presentParticiple": [
        "running out",
        "running out of"
      ],
      "past": [
        "ran out",
        "ran out of"
      ],
      "pastParticiple": [
        "run out",
        "run out of"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "cello",
    "explanation": "a large musical instrument like a violin that is held between the player's knees while the player sits",
    "vocabType": "Context",
    "ipa": "/ˈtʃeləʊ/",
    "example": "She holds her cello between her knees while playing.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "plural": [
        "cellos"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "compose",
    "explanation": "to write music",
    "vocabType": "Context",
    "ipa": "/kəmˈpəʊz/",
    "example": "I want to compose a song for Mum's birthday.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "rhythm",
    "explanation": "a strong regular repeated pattern of sounds or movements",
    "vocabType": "Extension",
    "ipa": "/ˈrɪðəm/",
    "example": "We clapped our hands to the rhythm of the music.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 2",
    "word": "offer",
    "explanation": "to provide the opportunity for something; to provide access to something",
    "vocabType": "Extension",
    "ipa": "/ˈɒfə/",
    "example": "Our school offers free music lessons to all pupils.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 3",
    "word": "sketch",
    "explanation": "a simple picture that is drawn quickly and does not have many details",
    "vocabType": "Extension",
    "ipa": "/sketʃ/",
    "example": "I made a quick sketch of our sleeping cat.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 3",
    "word": "represent",
    "explanation": "to be an example or expression of something",
    "vocabType": "Extension",
    "ipa": "/ˌreprɪˈzent/",
    "example": "The dove in my drawing represents peace.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 3",
    "word": "repair",
    "explanation": "to fix something that is broken, damaged or torn",
    "vocabType": "Extension",
    "ipa": "/rɪˈpeə/",
    "example": "Dad helped me repair the broken wheel on my toy.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 3",
    "word": "process",
    "explanation": "a series of things that are done in order to achieve a particular result",
    "vocabType": "Extension",
    "ipa": "/ˈprəʊses/",
    "example": "We learned the process of making bread at school.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 8",
    "lesson": "Lesson 3",
    "word": "architecture",
    "explanation": "the art and study of designing buildings",
    "vocabType": "Extension",
    "ipa": "/ˈɑːkɪtektʃə/",
    "example": "My sister studies architecture and designs houses at college.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "slip",
    "explanation": "to slide a short distance by accident so that you fall or nearly fall",
    "vocabType": "Target",
    "ipa": "/slɪp/",
    "example": "Be careful not to slip on the wet floor.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative",
        "presentParticiple",
        "past",
        "pastParticiple"
      ],
      "presentParticiple": [
        "slipping"
      ],
      "past": [
        "slipped"
      ],
      "pastParticiple": [
        "slipped"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "flippers",
    "explanation": "A pair of flat rubber shoes with wide fronts used for swimming",
    "vocabType": "Context",
    "ipa": "/ˈflɪp.əz/",
    "example": "These yellow flippers help me swim through the water.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "gloves",
    "explanation": "a pair of coverings for the hand that has separate parts for each finger",
    "vocabType": "Context",
    "ipa": "/ɡlʌvz/",
    "example": "My warm gloves keep every finger cosy in winter.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "goggles",
    "explanation": "a pair of glasses that fit closely to the face to protect the eyes from wind, dust, water, etc. or give extra visual powers",
    "vocabType": "Context",
    "ipa": "/ˈɡɒɡ.əlz/",
    "example": "I wear goggles to protect my eyes when swimming.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "lifejacket",
    "explanation": "a jacket without arms that can be filled with air, designed to help you float if you fall in water",
    "vocabType": "Context",
    "ipa": "/ˈlaɪfˌdʒæk.ɪt/",
    "example": "Everyone puts on a lifejacket before entering the boat.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "parachute",
    "explanation": "a piece of equipment usually made of cloth that is fastened to people or things and that allows them to fall slowly and land safely after they have jumped or been dropped from an aircraft",
    "vocabType": "Context",
    "ipa": "/ˈpær.ə.ʃuːt/",
    "example": "The parachute opens and carries the jumper safely down.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "get the hang of",
    "explanation": "to learn how to do or to use something",
    "vocabType": "Target",
    "ipa": "/ɡet ðə ˈhæŋ əv/",
    "example": "You will get the hang of skating with practice.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "gets the hang of"
      ],
      "presentParticiple": [
        "getting the hang of"
      ],
      "past": [
        "got the hang of"
      ],
      "pastParticiple": [
        "got the hang of"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "harness",
    "explanation": "a set of straps for fastening something to a person’s body or to keep them from moving off or falling",
    "vocabType": "Target",
    "ipa": "/ˈhɑː.nəs/",
    "example": "The climbing instructor checks my harness before I climb.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "instructor",
    "explanation": "a person whose job is to teach somebody a practical skill or sport",
    "vocabType": "Target",
    "ipa": "/ɪnˈstrʌk.tə/",
    "example": "Our swimming instructor teaches us to float on our backs.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "lean",
    "explanation": "to bend or move from a straight position",
    "vocabType": "Target",
    "ipa": "/liːn/",
    "example": "Please do not lean out of the classroom window.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative",
        "past",
        "pastParticiple"
      ],
      "past": [
        "leant",
        "leaned"
      ],
      "pastParticiple": [
        "leant",
        "leaned"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "risk",
    "explanation": "the possibility of something bad happening at some time in the future",
    "vocabType": "Target",
    "ipa": "/rɪsk/",
    "example": "Wearing a helmet reduces the risk of hurting your head.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "simply",
    "explanation": "used to emphasize how easy or basic something is",
    "vocabType": "Target",
    "ipa": "/ˈsɪm.pli/",
    "example": "Simply press this green button to start the game.",
    "partOfSpeech": [
      "adv."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "wetsuit",
    "explanation": "a piece of clothing made of rubber that fits the whole body closely, worn, for example, by people swimming underwater or sailing in order to keep warm",
    "vocabType": "Context",
    "ipa": "/ˈwet.suːt/",
    "example": "My wetsuit keeps me warm in the cold sea.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "extreme sport",
    "explanation": "a sport that is extremely exciting to do and often dangerous, for example skydiving and bungee jumping",
    "vocabType": "Extension",
    "ipa": "/ɪkˌstriːm ˈspɔːt/",
    "example": "Skydiving is an extreme sport that involves jumping from planes.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "plural": [
        "extreme sports"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "attach",
    "explanation": "to fasten or join one thing to another",
    "vocabType": "Extension",
    "ipa": "/əˈtætʃ/",
    "example": "Please attach your name tag to your school bag.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "propel",
    "explanation": "to move, drive or push something forwards or in a particular direction",
    "vocabType": "Extension",
    "ipa": "/prəˈpel/",
    "example": "The wind can propel our little boat across the lake.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative",
        "presentParticiple",
        "past",
        "pastParticiple"
      ],
      "presentParticiple": [
        "propelling"
      ],
      "past": [
        "propelled"
      ],
      "pastParticiple": [
        "propelled"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 1",
    "word": "abseiling",
    "explanation": "the sport or activity of going down a steep cliff or rock while attached to a rope, pushing against the slope or rock with your feet",
    "vocabType": "Extension",
    "ipa": "/ˈæb.seɪ.lɪŋ/",
    "example": "The instructor uses a rope to teach adults abseiling.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "edge",
    "explanation": "the outside limit of an object, a surface or an area",
    "vocabType": "Target",
    "ipa": "/edʒ/",
    "example": "Keep your glass away from the edge of the table.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "fear",
    "explanation": "an unpleasant emotion caused by being aware of danger",
    "vocabType": "Target",
    "ipa": "/fɪə/",
    "example": "The loud thunder filled our little puppy with fear.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "strength",
    "explanation": "the quality of being physically strong; the quality of being brave and determined in a difficult situation",
    "vocabType": "Target",
    "ipa": "/streŋθ/",
    "example": "Dad uses his strength to lift the heavy box.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "timing",
    "explanation": "the time when something happens or is done especially when it is thought of as having a good or bad effect on the result",
    "vocabType": "Target",
    "ipa": "/ˈtaɪ.mɪŋ/",
    "example": "Good timing helps me jump over the skipping rope.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "tradition",
    "explanation": "a way of thinking, behaving, or doing something that has been used by the people in a particular group, family, society, etc., for a long time",
    "vocabType": "Target",
    "ipa": "/trəˈdɪʃ.ən/",
    "example": "Making dumplings together is a tradition in our family.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "wave",
    "explanation": "a raised line of water that moves across the surface of the sea, ocean, etc.",
    "vocabType": "Target",
    "ipa": "/weɪv/",
    "example": "A small wave washes over my feet at the beach.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "cliff",
    "explanation": "a high area of rock with a very steep side, often at the edge of the sea or ocean",
    "vocabType": "Target",
    "ipa": "/klɪf/",
    "example": "We watch seabirds nesting high on the rocky cliff.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "steep",
    "explanation": "almost straight up and down",
    "vocabType": "Extension",
    "ipa": "/stiːp/",
    "example": "This steep hill is difficult for us to climb.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "pause",
    "explanation": "to stop talking or doing something for a short time before continuing",
    "vocabType": "Extension",
    "ipa": "/pɔːz/",
    "example": "We pause for a drink before continuing our walk.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "blast",
    "explanation": "to violently destroy or break something into pieces, using explosives",
    "vocabType": "Extension",
    "ipa": "/blɑːst/",
    "example": "The workers blast the rock to build a tunnel.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "form",
    "explanation": "to start a group of people, such as an organisation, a committee, etc.",
    "vocabType": "Extension",
    "ipa": "/fɔːm/",
    "example": "We want to form a reading club at school.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "tide",
    "explanation": "a regular rise and fall in the level of the sea, caused by the pull of the moon and sun",
    "vocabType": "Extension",
    "ipa": "/taɪd/",
    "example": "The rising tide slowly covers our sandcastle with water.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "errand",
    "explanation": "a job that you do for somebody that involves going somewhere to take a message, to buy something, deliver goods, etc.",
    "vocabType": "Extension",
    "ipa": "/ˈer.ənd/",
    "example": "Mum sends me on an errand to buy bread.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "aim",
    "explanation": "the purpose of doing something",
    "vocabType": "Context",
    "ipa": "/eɪm/",
    "example": "Our aim is to keep the playground clean.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "beat",
    "explanation": "to defeat (someone) in a game, contest, etc.",
    "vocabType": "Context",
    "ipa": "/biːt/",
    "example": "Our class hopes to beat the other team at football.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative",
        "past",
        "pastParticiple"
      ],
      "past": [
        "beat"
      ],
      "pastParticiple": [
        "beaten"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "challenge",
    "explanation": "a new or difficult task that tests somebody’s ability and skill",
    "vocabType": "Context",
    "ipa": "/ˈtʃæl.ɪndʒ/",
    "example": "This tricky puzzle is a fun challenge for us.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "deal with",
    "explanation": "to solve a problem, perform a task, etc.",
    "vocabType": "Context",
    "ipa": "/ˈdiːl wɪð/",
    "example": "Our teacher helps us deal with this difficult problem.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "deals with"
      ],
      "presentParticiple": [
        "dealing with"
      ],
      "past": [
        "dealt with"
      ],
      "pastParticiple": [
        "dealt with"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "score",
    "explanation": "the number of points, goals, etc. scored by each player or team in a game or competition",
    "vocabType": "Context",
    "ipa": "/skɔː/",
    "example": "The final score is three goals to two.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "surf",
    "explanation": "to take part in the sport of riding on waves on a surfboard",
    "vocabType": "Context",
    "ipa": "/sɜːf/",
    "example": "My cousin learns to surf with a qualified instructor.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 2",
    "word": "carry on",
    "explanation": "to cause (something, such as a tradition) to continue",
    "vocabType": "Extension",
    "ipa": "/ˌkær.i ˈɒn/",
    "example": "We carry on our family tradition of baking together.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "carries on"
      ],
      "presentParticiple": [
        "carrying on"
      ],
      "past": [
        "carried on"
      ],
      "pastParticiple": [
        "carried on"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 3",
    "word": "iron",
    "explanation": "to make clothes, etc. smooth by using an iron (=a tool with a flat metal base that can be heated and used to make clothes smooth)",
    "vocabType": "Extension",
    "ipa": "/aɪən/",
    "example": "Dad will iron my school shirt before breakfast.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 3",
    "word": "participate",
    "explanation": "to take part in or become involved in an activity",
    "vocabType": "Extension",
    "ipa": "/pɑːˈtɪs.ɪ.peɪt/",
    "example": "All our classmates can participate in the school concert.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 3",
    "word": "participant",
    "explanation": "a person who is taking part in an activity or event",
    "vocabType": "Extension",
    "ipa": "/pɑːˈtɪs.ɪ.pənt/",
    "example": "Every participant in the race receives a colourful badge.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 3",
    "word": "wrinkle",
    "explanation": "a small fold that you do not want in a piece of cloth or paper",
    "vocabType": "Extension",
    "ipa": "/ˈrɪŋ.kəl/",
    "example": "Mum irons the wrinkle out of my shirt.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 9",
    "lesson": "Lesson 3",
    "word": "nickname",
    "explanation": "an informal, often humorous, name for a person that is connected with their real name, their personality or appearance, or with something they have done",
    "vocabType": "Extension",
    "ipa": "/ˈnɪk.neɪm/",
    "example": "My nickname is Bunny because I love hopping around.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "specialise (AmE specialize)",
    "explanation": "to limit your business or area of study to one specific subject",
    "vocabType": "Target",
    "ipa": "/ˈspeʃəlaɪz/",
    "example": "My aunt wants to specialise in caring for sick animals.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "analyse (AmE analyze)",
    "explanation": "to study (something) closely and carefully",
    "vocabType": "Context",
    "ipa": "/ˈænəlaɪz/",
    "example": "We analyse the water samples during our science lesson.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "device",
    "explanation": "an object or a piece of equipment that has been designed to do a particular job",
    "vocabType": "Context",
    "ipa": "/dɪˈvaɪs/",
    "example": "This small device measures the temperature in our classroom.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "habitat",
    "explanation": "the place or type of place where a plant or animal naturally or normally lives or grows",
    "vocabType": "Context",
    "ipa": "/ˈhæbɪtæt/",
    "example": "The pond is a natural habitat for these frogs.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "impact",
    "explanation": "a powerful or major influence or effect",
    "vocabType": "Context",
    "ipa": "/ˈɪmpækt/",
    "example": "Planting trees can have a positive impact on wildlife.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "maintain",
    "explanation": "to cause (something) to exist or continue without changing",
    "vocabType": "Context",
    "ipa": "/meɪnˈteɪn/",
    "example": "The heater helps maintain a steady temperature for our fish.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "coral reef",
    "explanation": "a long line of coral that lies in warm, shallow water",
    "vocabType": "Target",
    "ipa": "/ˌkɒrəl ˈriːf/",
    "example": "Colourful fish swam around the coral reef in warm water.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "plural": [
        "coral reefs"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "ecosystem",
    "explanation": "all the plants and living creatures in a particular area considered in relation to their physical environment",
    "vocabType": "Target",
    "ipa": "/ˈiːkəʊsɪstəm/",
    "example": "Plants, insects, and frogs all belong to the pond ecosystem.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "endangered",
    "explanation": "(used especially about groups of animals, plants, etc.) at risk of no longer existing",
    "vocabType": "Target",
    "ipa": "/ɪnˈdeɪndʒəd/",
    "example": "We made posters to help protect endangered sea turtles.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "keep track of",
    "explanation": "to have information about what is happening or where somebody/something is",
    "vocabType": "Target",
    "ipa": "/kiːp træk əv/",
    "example": "I use a notebook to keep track of my homework.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "thirdPerson": [
        "keeps track of"
      ],
      "presentParticiple": [
        "keeping track of"
      ],
      "past": [
        "kept track of"
      ],
      "pastParticiple": [
        "kept track of"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "marine",
    "explanation": "connected with the sea and the creatures and plants that live there",
    "vocabType": "Target",
    "ipa": "/məˈriːn/",
    "example": "We learnt about marine animals during our aquarium visit.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "shell",
    "explanation": "the hard outer part of eggs, nuts, some seeds, and some animals",
    "vocabType": "Target",
    "ipa": "/ʃel/",
    "example": "The snail hid inside its shell when I came closer.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "assess",
    "explanation": "to make a judgment about (something)",
    "vocabType": "Extension",
    "ipa": "/əˈses/",
    "example": "Our teacher will assess how well we understand the story.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 1",
    "word": "bleach",
    "explanation": "to become white or pale by a chemical process or by the effect of light from the sun; to make something white or pale in this way",
    "vocabType": "Extension",
    "ipa": "/bliːtʃ/",
    "example": "Strong sunlight can bleach the colour from our curtains.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "pirate",
    "explanation": "someone who attacks and steals from a ship at sea",
    "vocabType": "Target",
    "ipa": "/ˈpaɪrət/",
    "example": "The pirate in our story stole gold from passing ships.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "sink",
    "explanation": "to damage a boat or ship so that it goes below the surface of the sea, etc.",
    "vocabType": "Target",
    "ipa": "/sɪŋk/",
    "example": "In the story, pirates tried to sink the empty ship.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "past": [
        "sank"
      ],
      "pastParticiple": [
        "sunk"
      ],
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative",
        "past",
        "pastParticiple"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "steal",
    "explanation": "to take (something that does not belong to you) in a way that is wrong or illegal",
    "vocabType": "Target",
    "ipa": "/stiːl/",
    "example": "The naughty pirate tried to steal the treasure chest.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "past": [
        "stole"
      ],
      "pastParticiple": [
        "stolen"
      ],
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative",
        "past",
        "pastParticiple"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "capture",
    "explanation": "to take and hold (someone) as a prisoner especially by using force",
    "vocabType": "Context",
    "ipa": "/ˈkæptʃə/",
    "example": "In our story, soldiers capture the pirate captain.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "disaster",
    "explanation": "an unexpected event, such as a very bad accident, a flood or a fire, that kills a lot of people or causes a lot of damage",
    "vocabType": "Context",
    "ipa": "/dɪˈzɑːstə/",
    "example": "Our class collected blankets for families after the flood disaster.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "horrible",
    "explanation": "very bad or unpleasant",
    "vocabType": "Context",
    "ipa": "/ˈhɒrəbl/",
    "example": "A horrible smell came from the old rubbish bin.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more horrible"
      ],
      "superlative": [
        "most horrible"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "artefact",
    "explanation": "an object that is made by a person, especially something of historical or cultural interest",
    "vocabType": "Target",
    "ipa": "/ˈɑːtəfækt/",
    "example": "We saw an ancient clay artefact in the museum.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "other": [
        "artifact"
      ],
      "plural": [
        "artifacts"
      ],
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "fort",
    "explanation": "a building or buildings built in order to defend an area against attack",
    "vocabType": "Target",
    "ipa": "/fɔːt/",
    "example": "The old stone fort once protected the coastal town.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "goods",
    "explanation": "things that are produced to be sold",
    "vocabType": "Target",
    "ipa": "/ɡʊdz/",
    "example": "The shop sells goods such as toys and books.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "harbour (AmE harbor)",
    "explanation": "an area of water on the coast, protected from the open sea by strong walls, where ships can shelter",
    "vocabType": "Target",
    "ipa": "/ˈhɑːbə/",
    "example": "The fishing boats stayed safely inside the harbour during the storm.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "strike",
    "explanation": "to happen suddenly and have a harmful or damaging effect on somebody/something",
    "vocabType": "Extension",
    "ipa": "/straɪk/",
    "example": "A storm may strike our village later today.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "past": [
        "struck"
      ],
      "pastParticiple": [
        "struck"
      ],
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative",
        "past",
        "pastParticiple"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "wrongdoing",
    "explanation": "illegal or dishonest behaviour",
    "vocabType": "Extension",
    "ipa": "/ˈrɒŋduːɪŋ/",
    "example": "The detective discovered the pirate captain's wrongdoing in our story.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "punishment",
    "explanation": "an act or a way of punishing somebody",
    "vocabType": "Context",
    "ipa": "/ˈpʌnɪʃmənt/",
    "example": "Missing playtime was his punishment for breaking the rules.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "trade",
    "explanation": "to buy and sell goods or services, especially between countries",
    "vocabType": "Context",
    "ipa": "/treɪd/",
    "example": "Our teacher explained how countries trade food and toys.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "realise (AmE realize)",
    "explanation": "to understand or become aware of a particular fact or situation",
    "vocabType": "Extension",
    "ipa": "/ˈrɪəlaɪz/",
    "example": "I suddenly realised that my lunchbox was still at home.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "benefit",
    "explanation": "to be useful to somebody or improve their life in some way",
    "vocabType": "Extension",
    "ipa": "/ˈbenɪfɪt/",
    "example": "The new playground will benefit all the children nearby.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "presentParticiple": [
        "benefitting"
      ],
      "past": [
        "benefitted"
      ],
      "pastParticiple": [
        "benefitted"
      ],
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "jump",
    "explanation": "to rise suddenly by a large amount",
    "vocabType": "Extension",
    "ipa": "/dʒʌmp/",
    "example": "Ice cream sales jumped during the very hot weekend.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 2",
    "word": "behave",
    "explanation": "to do things in a way that people think is correct or polite",
    "vocabType": "Extension",
    "ipa": "/bɪˈheɪv/",
    "example": "Please behave while our teacher reads us a story.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "bizarre",
    "explanation": "very strange or unusual",
    "vocabType": "Extension",
    "ipa": "/bɪˈzɑː/",
    "example": "I drew a bizarre animal with three purple tails.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "comparative": [
        "more bizarre"
      ],
      "superlative": [
        "most bizarre"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "vampire",
    "explanation": "(in stories) a dead person who leaves their grave (= where they are buried) at night to bite living people and drink their blood",
    "vocabType": "Extension",
    "ipa": "/ˈvæmpaɪə/",
    "example": "The vampire in our story only came outside at night.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "in the meantime",
    "explanation": "in the period of time between two times or two events",
    "vocabType": "Extension",
    "ipa": "/ɪn ðə ˈmiːntaɪm/",
    "example": "Dinner is cooking; in the meantime, we can set the table.",
    "partOfSpeech": [
      "adv."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "yeti",
    "explanation": "a large creature like a bear or a man covered with hair that some people believe lives in the Himalayan mountains",
    "vocabType": "Extension",
    "ipa": "/ˈjeti/",
    "example": "Our adventure story has a yeti hiding in snowy mountains.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "echolocation",
    "explanation": "the use of reflected sound waves for finding things, especially by creatures such as dolphins and bats",
    "vocabType": "Extension",
    "ipa": "/ˌekəʊləʊˈkeɪʃən/",
    "example": "Bats use echolocation to find insects in the dark.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "blind",
    "explanation": "not able to see",
    "vocabType": "Extension",
    "ipa": "/blaɪnd/",
    "example": "The blind boy read his book using raised dots.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "abominable",
    "explanation": "extremely unpleasant and causing horror",
    "vocabType": "Extension",
    "ipa": "/əˈbɒmɪnəbl/",
    "example": "The villain's abominable cruelty frightened everyone in the fairy tale.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "bacteria",
    "explanation": "the simplest and smallest forms of life. Bacteria exist in large numbers in air, water and soil, and also in living and dead creatures and plants, and are often a cause of disease.",
    "vocabType": "Extension",
    "ipa": "/bækˈtɪəriə/",
    "example": "Washing our hands helps remove harmful bacteria before lunch.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "other": [
        "bacterium"
      ],
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "prey",
    "explanation": "an animal, a bird, etc. that is hunted, killed and eaten by another",
    "vocabType": "Extension",
    "ipa": "/preɪ/",
    "example": "The owl watched its prey moving through the grass.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "muscular",
    "explanation": "relating to the muscles",
    "vocabType": "Extension",
    "ipa": "/ˈmʌskjələ/",
    "example": "The doctor explained how muscular contractions help our legs move.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 10",
    "lesson": "Lesson 3",
    "word": "bioluminescence",
    "explanation": "the natural production of light by living creatures such as glow-worms",
    "vocabType": "Extension",
    "ipa": "/ˌbaɪəʊˌluːmɪˈnesəns/",
    "example": "Bioluminescence makes glow-worms shine in the dark garden.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "text message",
    "explanation": "a written message that you send using a mobile phone",
    "vocabType": "Target",
    "ipa": "/ˈtekst mesɪdʒ/",
    "example": "Mum sent Dad a text message from her phone.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "plural": [
        "text messages"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "abbreviation",
    "explanation": "a shortened form of a word or name that is used in place of the full word or name",
    "vocabType": "Context",
    "ipa": "/əˌbriːviˈeɪʃn/",
    "example": "'Dr' is an abbreviation for the word 'doctor'.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "character",
    "explanation": "a letter, sign, mark or symbol used in writing, in printing or on computers",
    "vocabType": "Context",
    "ipa": "/ˈkærəktə/",
    "example": "The password needs one number and one special character.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "punctuation",
    "explanation": "the use of punctuation marks in writing so that people can see when a sentence begins and finishes, that something is a question, etc.",
    "vocabType": "Context",
    "ipa": "/ˌpʌŋktʃuˈeɪʃn/",
    "example": "Our teacher helped us add punctuation to our stories.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "symbol",
    "explanation": "a sign, number, letter, etc. that has a fixed meaning, especially in science, mathematics and music",
    "vocabType": "Context",
    "ipa": "/ˈsɪmbl/",
    "example": "The plus symbol tells us to add two numbers.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "type",
    "explanation": "to write something using a computer keyboard or typewriter",
    "vocabType": "Context",
    "ipa": "/taɪp/",
    "example": "I can type my name on the computer.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "communicate",
    "explanation": "to share or exchange information, news, ideas, feelings, etc.",
    "vocabType": "Target",
    "ipa": "/kəˈmjuːnɪkeɪt/",
    "example": "We communicate with Grandma through letters and video calls.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "joke",
    "explanation": "to say something to make people laugh",
    "vocabType": "Target",
    "ipa": "/dʒəʊk/",
    "example": "Dad likes to joke and make us laugh.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "on purpose",
    "explanation": "not by accident; deliberately",
    "vocabType": "Target",
    "ipa": "/ɒn ˈpɜːpəs/",
    "example": "I put extra cheese on your pizza on purpose.",
    "partOfSpeech": [
      "adv."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "poem",
    "explanation": "a piece of writing in which the words are chosen for their sound and the images they suggest, not just for their obvious meanings. The words are arranged in separate lines, usually with a repeated rhythm, and often the lines rhyme at the end.",
    "vocabType": "Target",
    "ipa": "/ˈpəʊɪm/",
    "example": "I wrote a short poem about my playful kitten.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "publish",
    "explanation": "to print a letter, an article, etc. in a newspaper or magazine",
    "vocabType": "Target",
    "ipa": "/ˈpʌblɪʃ/",
    "example": "Our school magazine will publish my letter next week.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "suggest",
    "explanation": "to put forward an idea or a plan for other people to think about",
    "vocabType": "Target",
    "ipa": "/səˈdʒest/",
    "example": "I suggest playing a quiet game after lunch.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "pack",
    "explanation": "a group of animals that hunt together or are kept for hunting",
    "vocabType": "Extension",
    "ipa": "/pæk/",
    "example": "A pack of wolves crossed the snowy forest together.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "site",
    "explanation": "a place connected to the internet, where a company or an organization, or an individual person, puts information",
    "vocabType": "Extension",
    "ipa": "/saɪt/",
    "example": "Our school's site has photos of the class picnic.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "poet",
    "explanation": "a person who writes poems",
    "vocabType": "Extension",
    "ipa": "/ˈpəʊɪt/",
    "example": "The poet wrote a funny poem about a duck.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 1",
    "word": "fake",
    "explanation": "not true or real",
    "vocabType": "Extension",
    "ipa": "/feɪk/",
    "example": "The toy pirate wore a fake beard and moustache.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "express (oneself)",
    "explanation": "to speak, write or communicate in some other way what you think or feel",
    "vocabType": "Target",
    "ipa": "/ɪkˈspres (wʌnˈself)/",
    "example": "Painting helps me express myself when words are difficult.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "expresses",
        "expresses oneself",
        "expresses himself",
        "expresses herself",
        "expresses itself",
        "expresses themselves"
      ],
      "presentParticiple": [
        "expressing",
        "expressing oneself",
        "expressing myself",
        "expressing yourself",
        "expressing himself",
        "expressing herself",
        "expressing itself",
        "expressing ourselves",
        "expressing yourselves",
        "expressing themselves"
      ],
      "past": [
        "expressed",
        "expressed oneself",
        "expressed myself",
        "expressed yourself",
        "expressed himself",
        "expressed herself",
        "expressed itself",
        "expressed ourselves",
        "expressed yourselves",
        "expressed themselves"
      ],
      "pastParticiple": [
        "expressed",
        "expressed oneself",
        "expressed myself",
        "expressed yourself",
        "expressed himself",
        "expressed herself",
        "expressed itself",
        "expressed ourselves",
        "expressed yourselves",
        "expressed themselves"
      ],
      "other": [
        "express myself",
        "express yourself",
        "express himself",
        "express herself",
        "express itself",
        "express ourselves",
        "express yourselves",
        "express themselves"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "identify",
    "explanation": "to know and say who someone is or what something is",
    "vocabType": "Target",
    "ipa": "/aɪˈdentɪfaɪ/",
    "example": "Can you identify this bird by its bright feathers?",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "indicate",
    "explanation": "to show (something)",
    "vocabType": "Target",
    "ipa": "/ˈɪndɪkeɪt/",
    "example": "The arrows indicate where our classroom is.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "signal",
    "explanation": "something (such as a sound, a movement of part of the body, or an object) that gives information about something or that tells someone to do something",
    "vocabType": "Target",
    "ipa": "/ˈsɪɡnəl/",
    "example": "The bell is a signal to start our lesson.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "whistle",
    "explanation": "the sound that you make by forcing your breath out when your lips are almost closed",
    "vocabType": "Target",
    "ipa": "/ˈwɪsl/",
    "example": "Dad made a loud whistle by blowing through his lips.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "affection",
    "explanation": "a feeling of liking and caring for someone or something",
    "vocabType": "Context",
    "ipa": "/əˈfekʃn/",
    "example": "Our puppy shows affection by licking our hands.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "command",
    "explanation": "an order given to a person or an animal",
    "vocabType": "Target",
    "ipa": "/kəˈmɑːnd/",
    "example": "The dog sat down when it heard my command.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "complex",
    "explanation": "difficult to understand",
    "vocabType": "Target",
    "ipa": "/ˈkɒmpleks/",
    "example": "The puzzle has complex rules that are hard to understand.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "comparative": [
        "more complex"
      ],
      "superlative": [
        "most complex"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "bite",
    "explanation": "an act of biting",
    "vocabType": "Extension",
    "ipa": "/baɪt/",
    "example": "I took a small bite of my crunchy apple.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "vocal",
    "explanation": "connected with the voice",
    "vocabType": "Extension",
    "ipa": "/ˈvəʊkl/",
    "example": "We do vocal exercises before singing in the school choir.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "click",
    "explanation": "a short sharp sound",
    "vocabType": "Extension",
    "ipa": "/klɪk/",
    "example": "I heard a click when the door closed.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "pop",
    "explanation": "a short, sharp, explosive sound",
    "vocabType": "Extension",
    "ipa": "/pɒp/",
    "example": "The balloon burst with a loud pop.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "aggressive",
    "explanation": "angry, and behaving in a threatening way",
    "vocabType": "Context",
    "ipa": "/əˈɡresɪv/",
    "example": "The aggressive dog growled and showed its teeth.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "comparative": [
        "more aggressive"
      ],
      "superlative": [
        "most aggressive"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "imitate",
    "explanation": "to copy somebody/something",
    "vocabType": "Context",
    "ipa": "/ˈɪmɪteɪt/",
    "example": "My little brother likes to imitate my funny dance.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "relationship",
    "explanation": "the way in which two people, groups or countries behave towards each other or deal with each other",
    "vocabType": "Context",
    "ipa": "/rɪˈleɪʃnʃɪp/",
    "example": "I have a happy relationship with my younger sister.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "unique",
    "explanation": "being the only one of its kind",
    "vocabType": "Context",
    "ipa": "/juˈniːk/",
    "example": "Each snowflake has a unique shape, different from all others.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "define",
    "explanation": "to say or explain what the meaning of a word or phrase is",
    "vocabType": "Extension",
    "ipa": "/dɪˈfaɪn/",
    "example": "Can you define this word in a simple sentence?",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 2",
    "word": "blow",
    "explanation": "to send out air from the mouth",
    "vocabType": "Extension",
    "ipa": "/bləʊ/",
    "example": "I blow gently on my soup to cool it.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "past": [
        "blew"
      ],
      "pastParticiple": [
        "blown"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 3",
    "word": "pro",
    "explanation": "an argument for something: a reason to do something",
    "vocabType": "Extension",
    "ipa": "/prəʊ/",
    "example": "One pro of walking to school is getting exercise.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "plural": [
        "pros"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 3",
    "word": "con",
    "explanation": "an argument against something: a reason for not doing something",
    "vocabType": "Extension",
    "ipa": "/kɒn/",
    "example": "One con of camping is having no warm shower.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 3",
    "word": "instant message",
    "explanation": "a written message sent using a system on the internet that allows people to communicate with each other very quickly",
    "vocabType": "Extension",
    "ipa": "/ˌɪnstənt ˈmesɪdʒ/",
    "example": "Dad sent Grandma an instant message using his computer.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "plural": [
        "instant messages"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 3",
    "word": "charge",
    "explanation": "the amount of money that somebody asks for goods and services",
    "vocabType": "Extension",
    "ipa": "/tʃɑːdʒ/",
    "example": "There is a small charge for using the swimming pool.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 3",
    "word": "connection",
    "explanation": "a shared feeling of affection and understanding",
    "vocabType": "Extension",
    "ipa": "/kəˈnekʃn/",
    "example": "I feel a strong connection with my caring grandma.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 3",
    "word": "customer service",
    "explanation": "the department in a company answers customers' questions, exchanges goods that are not satisfactory, etc.",
    "vocabType": "Extension",
    "ipa": "/ˌkʌstəmə ˈsɜːvɪs/",
    "example": "Mum called customer service about my broken toy.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 11",
    "lesson": "Lesson 3",
    "word": "order",
    "explanation": "to ask for goods to be made or supplied; to ask for a service to be provided",
    "vocabType": "Extension",
    "ipa": "/ˈɔːdə/",
    "example": "We will order a birthday cake from the bakery.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "value",
    "explanation": "usefulness or importance",
    "vocabType": "Target",
    "ipa": "/ˈvæl.juː/",
    "example": "Our teacher explains the value of practising every day.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "bargain",
    "explanation": "to discuss prices, conditions, etc. with somebody in order to reach an agreement that is acceptable",
    "vocabType": "Context",
    "ipa": "/ˈbɑː.ɡɪn/",
    "example": "Mum bargains with the seller over the bicycle price.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "budget",
    "explanation": "to be careful about the amount of money you spend; to plan to spend an amount of money for a particular purpose",
    "vocabType": "Context",
    "ipa": "/ˈbʌdʒ.ɪt/",
    "example": "We budget carefully to save enough money for our holiday.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "deserve",
    "explanation": "used to say that someone or something should or should not have or be given something",
    "vocabType": "Context",
    "ipa": "/dɪˈzɜːv/",
    "example": "You deserve a rest after all your hard work.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "independent",
    "explanation": "confident and free to do things without needing help from other people",
    "vocabType": "Context",
    "ipa": "/ˌɪn.dɪˈpen.dənt/",
    "example": "Being independent means I can pack my own school bag.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "comparative": [
        "more independent"
      ],
      "superlative": [
        "most independent"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "manage",
    "explanation": "to use money, time, information, etc. in a sensible way",
    "vocabType": "Context",
    "ipa": "/ˈmæn.ɪdʒ/",
    "example": "I manage my pocket money so it lasts all week.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "allowance",
    "explanation": "an amount of money that is given to somebody regularly or for a particular purpose",
    "vocabType": "Target",
    "ipa": "/əˈlaʊ.əns/",
    "example": "I save part of my weekly allowance in a jar.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "appreciate",
    "explanation": "to understand the worth or importance of (something or someone)",
    "vocabType": "Target",
    "ipa": "/əˈpriː.ʃi.eɪt/",
    "example": "We appreciate the importance of clean water for everyone.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "chore",
    "explanation": "a small job that is done regularly",
    "vocabType": "Target",
    "ipa": "/tʃɔː/",
    "example": "Setting the table is my daily chore at home.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "hand",
    "explanation": "to give (something) to someone using your hands",
    "vocabType": "Target",
    "ipa": "/hænd/",
    "example": "Please hand me the blue pencil on the table.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "earn",
    "explanation": "to get money for work that you do",
    "vocabType": "Target",
    "ipa": "/ɜːn/",
    "example": "My sister earns pocket money by watering our neighbour's plants.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "receive",
    "explanation": "to get or accept something that is sent or given to you",
    "vocabType": "Target",
    "ipa": "/rɪˈsiːv/",
    "example": "I receive a birthday card from Grandma every year.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "for",
    "explanation": "in support of somebody/something",
    "vocabType": "Extension",
    "ipa": "/fɔː/",
    "example": "We all voted for a longer lunch break.",
    "partOfSpeech": [
      "prep."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "against",
    "explanation": "not to the advantage or favour of somebody/something",
    "vocabType": "Extension",
    "ipa": "/əˈɡenst/",
    "example": "The strong wind worked against our team during the race.",
    "partOfSpeech": [
      "prep."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "recognise (AmE recognize)",
    "explanation": "to admit or to be aware that something exists or is true",
    "vocabType": "Extension",
    "ipa": "/ˈrek.əɡ.naɪz/",
    "example": "We recognise that everyone needs a chance to speak.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "reward",
    "explanation": "a thing that you are given because you have done something good, worked hard, etc.",
    "vocabType": "Context",
    "ipa": "/rɪˈwɔːd/",
    "example": "Our teacher gives us a sticker as a reward.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "barter",
    "explanation": "to exchange goods, property, services, etc. for other goods, etc. without using money",
    "vocabType": "Extension",
    "ipa": "/ˈbɑː.tə/",
    "example": "We barter our spare stickers instead of using money.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "minted",
    "explanation": "recently produced, invented, etc.",
    "vocabType": "Extension",
    "ipa": "/ˈmɪn.tɪd/",
    "example": "Our club has a newly minted name and badge.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "per cent (AmE percent)",
    "explanation": "by, in or for every hundred",
    "vocabType": "Extension",
    "ipa": "/pə ˈsent/",
    "example": "Fifty per cent of our class walk to school.",
    "partOfSpeech": [
      "adj.",
      "adv."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "debate",
    "explanation": "an argument or a discussion expressing different opinions",
    "vocabType": "Extension",
    "ipa": "/dɪˈbeɪt/",
    "example": "Our class holds a debate about wearing school uniforms.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 1",
    "word": "argument",
    "explanation": "a reason or set of reasons that somebody uses to show that something is true or correct",
    "vocabType": "Extension",
    "ipa": "/ˈɑːɡ.jə.mənt/",
    "example": "She gives a strong argument for protecting the playground trees.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "access",
    "explanation": "to be able to have or use something, especially something that you have a right to",
    "vocabType": "Target",
    "ipa": "/ˈæk.ses/",
    "example": "We can access library books with our school cards.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "cattle",
    "explanation": "cows and bulls that are kept as farm animals for their milk or meat",
    "vocabType": "Target",
    "ipa": "/ˈkæt.əl/",
    "example": "The farmer keeps cattle in a large grassy field.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "exchange",
    "explanation": "to give something to somebody and at the same time receive the same type of thing from them",
    "vocabType": "Target",
    "ipa": "/ɪksˈtʃeɪndʒ/",
    "example": "My friend and I exchange postcards during the holidays.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "credit card",
    "explanation": "a small plastic card that you can use to buy goods and services and pay for them later",
    "vocabType": "Context",
    "ipa": "/ˈkred.ɪt ˌkɑːd/",
    "example": "Mum uses her credit card and pays the bill later.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "plural": [
        "credit cards"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "currency",
    "explanation": "the system of money that a country uses",
    "vocabType": "Context",
    "ipa": "/ˈkʌr.ən.si/",
    "example": "We need local currency when we travel abroad.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "note",
    "explanation": "a piece of paper money",
    "vocabType": "Context",
    "ipa": "/nəʊt/",
    "example": "Dad gives the shopkeeper a five-pound note.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "germ",
    "explanation": "a very small living thing that can cause infection and disease",
    "vocabType": "Extension",
    "ipa": "/dʒɜːm/",
    "example": "A tiny germ can spread when we share dirty towels.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "weapon",
    "explanation": "an object such as a knife, gun, bomb, etc. that is used for fighting or attacking somebody",
    "vocabType": "Extension",
    "ipa": "/ˈwep.ən/",
    "example": "The museum displays a wooden club used as a weapon.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "spear",
    "explanation": "a weapon with a long wooden handle and a sharp metal point used for fighting, hunting and fishing in the past",
    "vocabType": "Extension",
    "ipa": "/spɪə/",
    "example": "We saw an ancient spear in the history museum.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "extra",
    "explanation": "more than is usual or necessary (always used before a noun)",
    "vocabType": "Target",
    "ipa": "/ˈek.strə/",
    "example": "I pack an extra sandwich for my hungry brother.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "international",
    "explanation": "involving two or more countries",
    "vocabType": "Target",
    "ipa": "/ˌɪn.təˈnæʃ.ən.əl/",
    "example": "Teams from many countries play in this international competition.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "standard",
    "explanation": "following a particular standard set, for example, by an industry",
    "vocabType": "Target",
    "ipa": "/ˈstæn.dəd/",
    "example": "Our art paper comes in a standard size.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "wheat",
    "explanation": "a plant grown for its grain that is used to produce the flour for bread, cakes, pasta, etc.; the grain of this plant",
    "vocabType": "Target",
    "ipa": "/wiːt/",
    "example": "The farmer grows wheat to make flour for bread.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "cash",
    "explanation": "money in the form of coins or notes",
    "vocabType": "Context",
    "ipa": "/kæʃ/",
    "example": "I pay for my ice cream with cash.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "coin",
    "explanation": "a small flat piece of metal used as money",
    "vocabType": "Context",
    "ipa": "/kɔɪn/",
    "example": "I drop a shiny coin into my money box.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "cashpoint",
    "explanation": "a machine in or outside a bank, shop, etc., from which you can get money from your bank account using a special plastic card (ATM)",
    "vocabType": "Extension",
    "ipa": "/ˈkæʃ.pɔɪnt/",
    "example": "Dad gets some money from the cashpoint outside the bank.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "queue",
    "explanation": "to wait in a line of people, vehicles, etc. in order to do something, get something or go somewhere",
    "vocabType": "Extension",
    "ipa": "/kjuː/",
    "example": "We queue patiently for our turn on the slide.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative",
        "presentParticiple"
      ],
      "presentParticiple": [
        "queuing",
        "queueing"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "prop",
    "explanation": "a small object used by actors during the performance of a play or in a film",
    "vocabType": "Extension",
    "ipa": "/prɒp/",
    "example": "The wooden wand is a prop in our school play.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 2",
    "word": "host",
    "explanation": "to organise an event to which others are invited and make all the arrangements for them",
    "vocabType": "Extension",
    "ipa": "/həʊst/",
    "example": "Our class will host a party for the new pupils.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "arrange",
    "explanation": "to plan or organise something in advance",
    "vocabType": "Extension",
    "ipa": "/əˈreɪndʒ/",
    "example": "Our teacher will arrange a trip to the farm.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "star-gazing",
    "explanation": "the act or practice of looking at or studying the stars",
    "vocabType": "Extension",
    "ipa": "/ˈstɑːˌɡeɪ.zɪŋ/",
    "example": "We enjoy star-gazing together on clear nights in the garden.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "constellation",
    "explanation": "a group of stars that forms a shape in the sky and has a name",
    "vocabType": "Extension",
    "ipa": "/ˌkɒn.stəˈleɪ.ʃən/",
    "example": "Dad shows me a constellation shaped like a hunter.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "invite over",
    "explanation": "to ask somebody to come to your home",
    "vocabType": "Extension",
    "ipa": "/ɪnˌvaɪt ˈəʊ.və/",
    "example": "Who should we invite over for games on Saturday?",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "invites over"
      ],
      "presentParticiple": [
        "inviting over"
      ],
      "past": [
        "invited over"
      ],
      "pastParticiple": [
        "invited over"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "script",
    "explanation": "a written text of a play, film, broadcast, talk, etc.",
    "vocabType": "Extension",
    "ipa": "/skrɪpt/",
    "example": "I read the script to learn my lines for the play.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "household",
    "explanation": "of or relating to a house or to the people living in a house",
    "vocabType": "Extension",
    "ipa": "/ˈhaʊs.həʊld/",
    "example": "We all share the household chores after school.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "face",
    "explanation": "if you face a particular situation, or it faces you, you have to deal with it",
    "vocabType": "Extension",
    "ipa": "/feɪs/",
    "example": "We face a difficult problem, but we can work together.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "come by",
    "explanation": "to make a short visit to a place, in order to see somebody",
    "vocabType": "Extension",
    "ipa": "/ˌkʌm ˈbaɪ/",
    "example": "Grandma will come by for tea after school.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "comes by"
      ],
      "presentParticiple": [
        "coming by"
      ],
      "past": [
        "came by"
      ],
      "pastParticiple": [
        "come by"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "add up",
    "explanation": "to increase by small amounts until there is a large total",
    "vocabType": "Extension",
    "ipa": "/ˌæd ˈʌp/",
    "example": "Small savings add up over time in my money box.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ],
      "thirdPerson": [
        "adds up"
      ],
      "presentParticiple": [
        "adding up"
      ],
      "past": [
        "added up"
      ],
      "pastParticiple": [
        "added up"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "assume",
    "explanation": "to think or accept that something is true but without having proof of it",
    "vocabType": "Extension",
    "ipa": "/əˈsjuːm/",
    "example": "Do not assume the box is empty without looking inside.",
    "partOfSpeech": [
      "v."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "annual",
    "explanation": "happening or done once every year",
    "vocabType": "Extension",
    "ipa": "/ˈæn.ju.əl/",
    "example": "Our annual sports day takes place every summer.",
    "partOfSpeech": [
      "adj."
    ],
    "wordForms": {
      "disableGenerated": [
        "plural",
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "receipt",
    "explanation": "a piece of paper or an electronic document that shows that goods or services have been paid for",
    "vocabType": "Extension",
    "ipa": "/rɪˈsiːt/",
    "example": "Mum keeps the receipt after paying for my new shoes.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  },
  {
    "stage": "5B",
    "unit": "Unit 12",
    "lesson": "Lesson 3",
    "word": "herd",
    "explanation": "a group of animals of the same type that live and feed together",
    "vocabType": "Extension",
    "ipa": "/hɜːd/",
    "example": "A herd of cows grazes peacefully beside the river.",
    "partOfSpeech": [
      "n."
    ],
    "wordForms": {
      "disableGenerated": [
        "thirdPerson",
        "presentParticiple",
        "past",
        "pastParticiple",
        "comparative",
        "superlative"
      ]
    }
  }
]

export const SYLLABLE_MAP_5B: Record<string, string[]> = {
  "stress": ["stress"],
  "breathe": ["breathe"],
  "comfortable": ["com", "fort", "a", "ble"],
  "diet": ["di", "et"],
  "fit": ["fit"],
  "mind": ["mind"],
  "emotional": ["e", "mo", "tion", "al"],
  "energetic": ["en", "er", "get", "ic"],
  "muscle": ["mus", "cle"],
  "physical": ["phys", "ic", "al"],
  "sense": ["sense"],
  "sore": ["sore"],
  "stream": ["stream"],
  "pain": ["pain"],
  "tense": ["tense"],
  "sprinter": ["sprint", "er"],
  "disability": ["dis", "a", "bil", "i", "ty"],
  "stroke": ["stroke"],
  "scented": ["scent", "ed"],
  "active": ["act", "ive"],
  "anxious": ["an", "xious"],
  "brain": ["brain"],
  "depressed": ["de", "pressed"],
  "memory": ["mem", "or", "y"],
  "produce": ["pro", "duce"],
  "satisfied": ["sat", "is", "fied"],
  "suffer": ["suf", "fer"],
  "cell": ["cell"],
  "bring out": ["bring", "out"],
  "catch on": ["catch", "on"],
  "mood": ["mood"],
  "self-confident": ["self", "con", "fi", "dent"],
  "belong": ["be", "long"],
  "benefit": ["ben", "e", "fit"],
  "negative": ["neg", "at", "ive"],
  "positive": ["pos", "it", "ive"],
  "exhausted": ["ex", "haust", "ed"],
  "upset": ["up", "set"],
  "text": ["text"],
  "vitamin": ["vit", "a", "min"],
  "sophisticated": ["so", "phis", "ti", "ca", "ted"],
  "copy": ["cop", "y"],
  "exhibition": ["ex", "hi", "bi", "tion"],
  "graffiti": ["graf", "fi", "ti"],
  "landscape": ["land", "scape"],
  "original": ["o", "rig", "i", "nal"],
  "abandoned": ["a", "ban", "doned"],
  "community": ["com", "mu", "ni", "ty"],
  "dull": ["dull"],
  "mural": ["mu", "ral"],
  "permission": ["per", "mis", "sion"],
  "public": ["pub", "lic"],
  "pipe": ["pipe"],
  "urban": ["ur", "ban"],
  "aim": ["aim"],
  "portrait": ["por", "trait"],
  "scene": ["scene"],
  "alley": ["al", "ley"],
  "decorate": ["dec", "o", "rate"],
  "limit to": ["lim", "it", "to"],
  "individual": ["in", "di", "vid", "u", "al"],
  "donate": ["do", "nate"],
  "motivate": ["mo", "ti", "vate"],
  "opportunity": ["op", "por", "tu", "ni", "ty"],
  "instrument": ["in", "stru", "ment"],
  "orchestra": ["or", "che", "stra"],
  "perform": ["per", "form"],
  "saxophone": ["sax", "o", "phone"],
  "tune": ["tune"],
  "violin": ["vi", "o", "lin"],
  "proud": ["proud"],
  "resident": ["res", "i", "dent"],
  "resource": ["re", "source"],
  "run out (of)": ["run", "out"],
  "cello": ["cel", "lo"],
  "compose": ["com", "pose"],
  "rhythm": ["rhyth", "m"],
  "offer": ["of", "fer"],
  "sketch": ["sketch"],
  "represent": ["rep", "re", "sent"],
  "repair": ["re", "pair"],
  "process": ["pro", "cess"],
  "architecture": ["ar", "chi", "tec", "ture"],
  "slip": ["slip"],
  "flippers": ["flip", "pers"],
  "gloves": ["gloves"],
  "goggles": ["gog", "gles"],
  "lifejacket": ["life", "jack", "et"],
  "parachute": ["par", "a", "chute"],
  "get the hang of": ["get", "the", "hang", "of"],
  "harness": ["har", "ness"],
  "instructor": ["in", "struc", "tor"],
  "lean": ["lean"],
  "risk": ["risk"],
  "simply": ["sim", "ply"],
  "wetsuit": ["wet", "suit"],
  "extreme sport": ["ex", "treme", "sport"],
  "attach": ["at", "tach"],
  "propel": ["pro", "pel"],
  "abseiling": ["ab", "sei", "ling"],
  "edge": ["edge"],
  "fear": ["fear"],
  "strength": ["strength"],
  "timing": ["ti", "ming"],
  "tradition": ["tra", "di", "tion"],
  "wave": ["wave"],
  "cliff": ["cliff"],
  "steep": ["steep"],
  "pause": ["pause"],
  "blast": ["blast"],
  "form": ["form"],
  "tide": ["tide"],
  "errand": ["er", "rand"],
  "beat": ["beat"],
  "challenge": ["chal", "lenge"],
  "deal with": ["deal", "with"],
  "score": ["score"],
  "surf": ["surf"],
  "carry on": ["car", "ry", "on"],
  "iron": ["i", "ron"],
  "participate": ["par", "ti", "ci", "pate"],
  "participant": ["par", "ti", "ci", "pant"],
  "wrinkle": ["wrin", "kle"],
  "nickname": ["nick", "name"],
  "specialise (ame specialize)": ["spe", "cial", "ise"],
  "analyse (ame analyze)": ["an", "a", "lyse"],
  "device": ["de", "vice"],
  "habitat": ["hab", "i", "tat"],
  "impact": ["im", "pact"],
  "maintain": ["main", "tain"],
  "coral reef": ["cor", "al", "reef"],
  "ecosystem": ["e", "co", "sys", "tem"],
  "endangered": ["en", "dan", "gered"],
  "keep track of": ["keep", "track", "of"],
  "marine": ["ma", "rine"],
  "shell": ["shell"],
  "assess": ["as", "sess"],
  "bleach": ["bleach"],
  "pirate": ["pi", "rate"],
  "sink": ["sink"],
  "steal": ["steal"],
  "capture": ["cap", "ture"],
  "disaster": ["dis", "as", "ter"],
  "horrible": ["hor", "ri", "ble"],
  "artefact": ["ar", "te", "fact"],
  "fort": ["fort"],
  "goods": ["goods"],
  "harbour (ame harbor)": ["har", "bour"],
  "strike": ["strike"],
  "wrongdoing": ["wrong", "do", "ing"],
  "punishment": ["pun", "ish", "ment"],
  "trade": ["trade"],
  "realise (ame realize)": ["real", "ise"],
  "jump": ["jump"],
  "behave": ["be", "have"],
  "bizarre": ["bi", "zarre"],
  "vampire": ["vam", "pire"],
  "in the meantime": ["in", "the", "mean", "time"],
  "yeti": ["ye", "ti"],
  "echolocation": ["ech", "o", "lo", "ca", "tion"],
  "blind": ["blind"],
  "abominable": ["a", "bom", "i", "na", "ble"],
  "bacteria": ["bac", "te", "ri", "a"],
  "prey": ["prey"],
  "muscular": ["mus", "cu", "lar"],
  "bioluminescence": ["bi", "o", "lu", "mi", "nes", "cence"],
  "text message": ["text", "mes", "sage"],
  "abbreviation": ["ab", "bre", "vi", "a", "tion"],
  "character": ["char", "ac", "ter"],
  "punctuation": ["punc", "tu", "a", "tion"],
  "symbol": ["sym", "bol"],
  "type": ["type"],
  "communicate": ["com", "mu", "ni", "cate"],
  "joke": ["joke"],
  "on purpose": ["on", "pur", "pose"],
  "poem": ["po", "em"],
  "publish": ["pub", "lish"],
  "suggest": ["sug", "gest"],
  "pack": ["pack"],
  "site": ["site"],
  "poet": ["po", "et"],
  "fake": ["fake"],
  "express (oneself)": ["ex", "press"],
  "identify": ["i", "den", "ti", "fy"],
  "indicate": ["in", "di", "cate"],
  "signal": ["sig", "nal"],
  "whistle": ["whis", "tle"],
  "affection": ["af", "fec", "tion"],
  "command": ["com", "mand"],
  "complex": ["com", "plex"],
  "bite": ["bite"],
  "vocal": ["vo", "cal"],
  "click": ["click"],
  "pop": ["pop"],
  "aggressive": ["ag", "gres", "sive"],
  "imitate": ["im", "i", "tate"],
  "relationship": ["re", "la", "tion", "ship"],
  "unique": ["u", "nique"],
  "define": ["de", "fine"],
  "blow": ["blow"],
  "pro": ["pro"],
  "con": ["con"],
  "instant message": ["in", "stant", "mes", "sage"],
  "charge": ["charge"],
  "connection": ["con", "nec", "tion"],
  "customer service": ["cus", "tom", "er", "ser", "vice"],
  "order": ["or", "der"],
  "value": ["val", "ue"],
  "bargain": ["bar", "gain"],
  "budget": ["budg", "et"],
  "deserve": ["de", "serve"],
  "independent": ["in", "de", "pen", "dent"],
  "manage": ["man", "age"],
  "allowance": ["al", "low", "ance"],
  "appreciate": ["ap", "pre", "ci", "ate"],
  "chore": ["chore"],
  "hand": ["hand"],
  "earn": ["earn"],
  "receive": ["re", "ceive"],
  "for": ["for"],
  "against": ["a", "gainst"],
  "recognise (ame recognize)": ["rec", "og", "nise"],
  "reward": ["re", "ward"],
  "barter": ["bar", "ter"],
  "minted": ["mint", "ed"],
  "per cent (ame percent)": ["per", "cent"],
  "debate": ["de", "bate"],
  "argument": ["ar", "gu", "ment"],
  "access": ["ac", "cess"],
  "cattle": ["cat", "tle"],
  "exchange": ["ex", "change"],
  "credit card": ["cred", "it", "card"],
  "currency": ["cur", "ren", "cy"],
  "note": ["note"],
  "germ": ["germ"],
  "weapon": ["weap", "on"],
  "spear": ["spear"],
  "extra": ["ex", "tra"],
  "international": ["in", "ter", "na", "tion", "al"],
  "standard": ["stan", "dard"],
  "wheat": ["wheat"],
  "cash": ["cash"],
  "coin": ["coin"],
  "cashpoint": ["cash", "point"],
  "queue": ["queue"],
  "prop": ["prop"],
  "host": ["host"],
  "arrange": ["ar", "range"],
  "star-gazing": ["star", "ga", "zing"],
  "constellation": ["con", "stel", "la", "tion"],
  "invite over": ["in", "vite", "o", "ver"],
  "script": ["script"],
  "household": ["house", "hold"],
  "face": ["face"],
  "come by": ["come", "by"],
  "add up": ["add", "up"],
  "assume": ["as", "sume"],
  "annual": ["an", "nu", "al"],
  "receipt": ["re", "ceipt"],
  "herd": ["herd"],
}

export const KW_MAP_5B: Record<string, [string, string][]> = {
  "stress": [["pressure from problems", "kw-red"], ["excessive demands", "kw-gold"]],
  "breathe": [["take air in", "kw-red"], ["send air out", "kw-gold"]],
  "comfortable": [["relaxed and happy", "kw-red"]],
  "diet": [["regular food and drink", "kw-red"]],
  "fit": [["healthy and strong", "kw-red"]],
  "mind": [["attention", "kw-red"]],
  "emotional": [["related to feelings", "kw-red"]],
  "energetic": [["full of energy", "kw-red"]],
  "muscle": [["body tissue for movement", "kw-red"]],
  "physical": [["related to the body", "kw-red"], ["not the mind", "kw-gold"]],
  "sense": [["bodily power of perception", "kw-red"]],
  "sore": [["painful", "kw-red"]],
  "stream": [["small narrow river", "kw-red"]],
  "pain": [["bodily discomfort", "kw-red"], ["injury or illness", "kw-gold"]],
  "tense": [["nervous", "kw-red"], ["unable to relax", "kw-gold"]],
  "sprinter": [["fast short-distance runner", "kw-red"]],
  "disability": [["condition limiting everyday activities", "kw-red"]],
  "stroke": [["move hand gently over fur", "kw-red"]],
  "scented": [["pleasantly fragrant", "kw-red"]],
  "active": [["always physically busy", "kw-red"]],
  "anxious": [["worried", "kw-red"]],
  "brain": [["organ inside the head", "kw-red"], ["control of bodily functions", "kw-gold"]],
  "depressed": [["very sad", "kw-red"], ["without hope", "kw-gold"]],
  "memory": [["ability to remember", "kw-red"]],
  "produce": [["cause particular results", "kw-red"]],
  "satisfied": [["pleased with events or actions", "kw-red"]],
  "suffer": [["experience pain", "kw-red"]],
  "cell": [["smallest unit of living matter", "kw-red"]],
  "bring out": [["produce", "kw-red"]],
  "catch on": [["become popular", "kw-red"]],
  "mood": [["current emotional state", "kw-red"]],
  "self-confident": [["confident in your abilities", "kw-red"]],
  "belong": [["be in the right place", "kw-red"]],
  "benefit": [["helpful result", "kw-red"]],
  "negative": [["harmful", "kw-red"]],
  "positive": [["useful", "kw-red"]],
  "exhausted": [["very tired", "kw-red"]],
  "upset": [["unhappy after unpleasant events", "kw-red"]],
  "text": [["send a written phone message", "kw-red"]],
  "vitamin": [["essential natural food substance", "kw-red"], ["healthy growth", "kw-gold"]],
  "sophisticated": [["highly developed and complex", "kw-red"]],
  "copy": [["near-identical reproduction", "kw-red"]],
  "exhibition": [["collection on public display", "kw-red"]],
  "graffiti": [["drawings on public walls", "kw-red"]],
  "landscape": [["countryside painting", "kw-red"]],
  "original": [["first version", "kw-red"], ["source of later copies", "kw-gold"]],
  "abandoned": [["left and no longer wanted", "kw-red"]],
  "community": [["people living in one area", "kw-red"]],
  "dull": [["not interesting", "kw-red"]],
  "mural": [["large painting on a wall", "kw-red"]],
  "permission": [["approval to act", "kw-red"]],
  "public": [["available for everyone to use", "kw-red"]],
  "pipe": [["tube for liquids and gases", "kw-red"]],
  "urban": [["related to towns and cities", "kw-red"]],
  "aim": [["have a specified goal", "kw-red"]],
  "portrait": [["visual likeness", "kw-red"], ["head and shoulders", "kw-gold"]],
  "scene": [["picture of a place", "kw-red"], ["activities happening there", "kw-gold"]],
  "alley": [["narrow passage between buildings", "kw-red"]],
  "decorate": [["make attractive with decorations", "kw-red"]],
  "limit to": [["restrict to particular place/group", "kw-red"]],
  "individual": [["single human considered separately", "kw-red"]],
  "donate": [["give to help others", "kw-red"]],
  "motivate": [["give a reason to act", "kw-red"]],
  "opportunity": [["chance to achieve a goal", "kw-red"]],
  "instrument": [["object producing musical sounds", "kw-red"]],
  "orchestra": [["large group of musicians", "kw-red"], ["led by a conductor", "kw-gold"]],
  "perform": [["entertain an audience", "kw-red"], ["with music or acting", "kw-gold"]],
  "saxophone": [["metal wind instrument with keys", "kw-red"]],
  "tune": [["ordered series of musical notes", "kw-red"]],
  "violin": [["four-stringed musical instrument", "kw-red"], ["played under the chin", "kw-gold"]],
  "proud": [["pleased with achievements or possessions", "kw-red"]],
  "resident": [["local inhabitant", "kw-red"]],
  "resource": [["available supply for use", "kw-red"]],
  "run out (of)": [["use up a supply", "kw-red"]],
  "cello": [["large string instrument", "kw-red"], ["held between the knees", "kw-gold"]],
  "compose": [["write music", "kw-red"]],
  "rhythm": [["regular repeated sound pattern", "kw-red"]],
  "offer": [["provide opportunities", "kw-red"]],
  "sketch": [["quick drawing with few details", "kw-red"]],
  "represent": [["serve as an example", "kw-red"]],
  "repair": [["fix damage", "kw-red"]],
  "process": [["steps towards a particular result", "kw-red"]],
  "architecture": [["art of designing buildings", "kw-red"]],
  "slip": [["slide by accident", "kw-red"], ["fall or nearly fall", "kw-gold"]],
  "flippers": [["wide rubber swimming shoes", "kw-red"]],
  "gloves": [["hand coverings with separate fingers", "kw-red"]],
  "goggles": [["close-fitting protective glasses", "kw-red"], ["extra visual powers", "kw-gold"]],
  "lifejacket": [["inflatable sleeveless flotation jacket", "kw-red"]],
  "parachute": [["equipment for slow safe landings", "kw-red"]],
  "get the hang of": [["learn how to use", "kw-red"]],
  "harness": [["body safety straps", "kw-red"]],
  "instructor": [["practical skills teacher", "kw-red"]],
  "lean": [["bend from upright", "kw-red"]],
  "risk": [["possibility of future harm", "kw-red"]],
  "simply": [["just", "kw-red"]],
  "wetsuit": [["warm close-fitting rubber suit", "kw-red"]],
  "extreme sport": [["exciting often dangerous sport", "kw-red"]],
  "attach": [["fasten together", "kw-red"]],
  "propel": [["push forwards", "kw-red"]],
  "abseiling": [["rope descent down a cliff", "kw-red"]],
  "edge": [["outside limit", "kw-red"]],
  "fear": [["emotion caused by danger", "kw-red"]],
  "strength": [["physical power", "kw-red"], ["bravery and determination", "kw-gold"]],
  "timing": [["time affecting results", "kw-red"]],
  "tradition": [["long-established shared custom", "kw-red"]],
  "wave": [["moving ridge of water", "kw-red"]],
  "cliff": [["high steep rock face", "kw-red"]],
  "steep": [["almost vertical", "kw-red"]],
  "pause": [["stop briefly before continuing", "kw-red"]],
  "blast": [["destroy using explosives", "kw-red"]],
  "form": [["start a group", "kw-red"]],
  "tide": [["regular sea-level rise and fall", "kw-red"]],
  "errand": [["task requiring a trip", "kw-red"]],
  "beat": [["defeat in a game", "kw-red"]],
  "challenge": [["difficult task testing skills", "kw-red"]],
  "deal with": [["solve a problem", "kw-red"]],
  "score": [["number of points", "kw-red"]],
  "surf": [["ride waves on a surfboard", "kw-red"]],
  "carry on": [["keep a tradition going", "kw-red"]],
  "iron": [["smooth clothes with heated metal", "kw-red"]],
  "participate": [["take part in activities", "kw-red"]],
  "participant": [["member taking part", "kw-red"]],
  "wrinkle": [["unwanted small fold", "kw-red"], ["in cloth or paper", "kw-gold"]],
  "nickname": [["informal personal name", "kw-red"]],
  "specialise (AmE specialize)": [["focus on one subject", "kw-red"]],
  "analyse (AmE analyze)": [["study closely and carefully", "kw-red"]],
  "device": [["equipment for a particular job", "kw-red"]],
  "habitat": [["natural living environment", "kw-red"]],
  "impact": [["powerful influence", "kw-red"]],
  "maintain": [["keep unchanged", "kw-red"]],
  "coral reef": [["long line of coral", "kw-red"], ["warm shallow water", "kw-gold"]],
  "ecosystem": [["interconnected organisms and environment", "kw-red"]],
  "endangered": [["at risk of extinction", "kw-red"]],
  "keep track of": [["stay informed about developments", "kw-red"], ["know current locations", "kw-gold"]],
  "marine": [["related to the sea", "kw-red"]],
  "shell": [["hard outer covering", "kw-red"]],
  "assess": [["make a judgment", "kw-red"]],
  "bleach": [["become white or pale", "kw-red"], ["make white or pale", "kw-gold"]],
  "pirate": [["robber of ships at sea", "kw-red"]],
  "sink": [["damage a ship until submerged", "kw-red"]],
  "steal": [["take property illegally", "kw-red"]],
  "capture": [["take prisoner by force", "kw-red"]],
  "disaster": [["unexpected destructive event", "kw-red"]],
  "horrible": [["very unpleasant", "kw-red"]],
  "artefact": [["human-made object", "kw-red"], ["historical or cultural interest", "kw-gold"]],
  "fort": [["defensive building", "kw-red"]],
  "goods": [["products for sale", "kw-red"]],
  "harbour (AmE harbor)": [["sheltered coastal water", "kw-red"], ["safe place for ships", "kw-gold"]],
  "strike": [["happen suddenly with harmful effects", "kw-red"]],
  "wrongdoing": [["illegal behaviour", "kw-red"]],
  "punishment": [["act of punishing", "kw-red"]],
  "trade": [["buy and sell goods", "kw-red"]],
  "realise (AmE realize)": [["become aware of facts", "kw-red"]],
  "jump": [["rise suddenly by a lot", "kw-red"]],
  "behave": [["act politely", "kw-red"]],
  "bizarre": [["very strange", "kw-red"]],
  "vampire": [["blood-drinking undead creature", "kw-red"]],
  "in the meantime": [["between two events", "kw-red"]],
  "yeti": [["legendary hairy Himalayan creature", "kw-red"]],
  "echolocation": [["location using reflected sound", "kw-red"]],
  "blind": [["unable to see", "kw-red"]],
  "abominable": [["extremely unpleasant", "kw-red"], ["horrifying", "kw-gold"]],
  "bacteria": [["simplest microscopic life forms", "kw-red"]],
  "prey": [["animal hunted for food", "kw-red"]],
  "muscular": [["related to muscles", "kw-red"]],
  "bioluminescence": [["natural light from living creatures", "kw-red"]],
  "text message": [["written mobile phone message", "kw-red"]],
  "abbreviation": [["shortened word form", "kw-red"]],
  "character": [["written symbol", "kw-red"]],
  "punctuation": [["use of marks in writing", "kw-red"]],
  "symbol": [["sign with a fixed meaning", "kw-red"]],
  "type": [["write using a keyboard", "kw-red"]],
  "communicate": [["share information", "kw-red"]],
  "joke": [["speak to make people laugh", "kw-red"]],
  "on purpose": [["deliberately", "kw-red"], ["not by accident", "kw-gold"]],
  "poem": [["expressive writing in rhythmic lines", "kw-red"]],
  "publish": [["print in newspapers or magazines", "kw-red"]],
  "suggest": [["put forward an idea", "kw-red"]],
  "pack": [["group of hunting animals", "kw-red"]],
  "site": [["internet location for information", "kw-red"]],
  "poet": [["writer of poems", "kw-red"]],
  "fake": [["not real", "kw-red"]],
  "express (oneself)": [["communicate thoughts and feelings", "kw-red"]],
  "identify": [["recognise and name", "kw-red"]],
  "indicate": [["show", "kw-red"]],
  "signal": [["sign conveying information", "kw-red"]],
  "whistle": [["breath sound through pursed lips", "kw-red"]],
  "affection": [["fondness", "kw-red"]],
  "command": [["order to obey", "kw-red"]],
  "complex": [["difficult to understand", "kw-red"]],
  "bite": [["act of biting", "kw-red"]],
  "vocal": [["related to the voice", "kw-red"]],
  "click": [["short sharp sound", "kw-red"]],
  "pop": [["short explosive sound", "kw-red"]],
  "aggressive": [["angry and threatening", "kw-red"]],
  "imitate": [["copy", "kw-red"]],
  "relationship": [["pattern of mutual interaction", "kw-red"]],
  "unique": [["only one of its kind", "kw-red"]],
  "define": [["explain a word's meaning", "kw-red"]],
  "blow": [["send air from the mouth", "kw-red"]],
  "pro": [["argument in favour", "kw-red"]],
  "con": [["argument against", "kw-red"], ["reason not to act", "kw-gold"]],
  "instant message": [["quickly exchanged online written message", "kw-red"]],
  "charge": [["price for goods or services", "kw-red"]],
  "connection": [["shared emotional bond", "kw-red"]],
  "customer service": [["department helping customers", "kw-red"], ["replacement of unsatisfactory goods", "kw-gold"]],
  "order": [["request goods or services", "kw-red"]],
  "value": [["usefulness", "kw-red"]],
  "bargain": [["discuss prices", "kw-red"], ["reach an agreement", "kw-gold"]],
  "budget": [["plan money spending", "kw-red"]],
  "deserve": [["be worthy of", "kw-red"]],
  "independent": [["confident without needing help", "kw-red"]],
  "manage": [["use resources sensibly", "kw-red"]],
  "allowance": [["regular money payment", "kw-red"]],
  "appreciate": [["understand worth", "kw-red"]],
  "chore": [["regular small job", "kw-red"]],
  "hand": [["pass using hands", "kw-red"]],
  "earn": [["get money for work", "kw-red"]],
  "receive": [["accept what is given", "kw-red"]],
  "for": [["in support of", "kw-red"]],
  "against": [["not favourable to", "kw-red"]],
  "recognise (AmE recognize)": [["accept as true", "kw-red"]],
  "reward": [["gift for good work", "kw-red"]],
  "barter": [["exchange without money", "kw-red"]],
  "minted": [["recently produced", "kw-red"]],
  "per cent (AmE percent)": [["for every hundred", "kw-red"]],
  "debate": [["discussion of different opinions", "kw-red"]],
  "argument": [["reasons supporting a claim", "kw-red"]],
  "access": [["be able to use", "kw-red"]],
  "cattle": [["farm cows and bulls", "kw-red"]],
  "exchange": [["give and receive in return", "kw-red"]],
  "credit card": [["payment card", "kw-red"], ["pay later", "kw-gold"]],
  "currency": [["national money system", "kw-red"]],
  "note": [["paper money", "kw-red"]],
  "germ": [["tiny disease-causing organism", "kw-red"]],
  "weapon": [["equipment for fighting", "kw-red"]],
  "spear": [["long pointed weapon", "kw-red"]],
  "extra": [["more than needed", "kw-red"]],
  "international": [["involving multiple countries", "kw-red"]],
  "standard": [["conforming to set standards", "kw-red"]],
  "wheat": [["flour-producing plant and grain", "kw-red"]],
  "cash": [["coins and notes", "kw-red"]],
  "coin": [["metal money piece", "kw-red"]],
  "cashpoint": [["cash withdrawal machine", "kw-red"]],
  "queue": [["wait in line", "kw-red"]],
  "prop": [["object used by actors", "kw-red"]],
  "host": [["organise an event", "kw-red"]],
  "arrange": [["plan in advance", "kw-red"]],
  "star-gazing": [["observation of stars", "kw-red"]],
  "constellation": [["named star pattern", "kw-red"]],
  "invite over": [["ask guests home", "kw-red"]],
  "script": [["written performance text", "kw-red"]],
  "household": [["related to home life", "kw-red"]],
  "face": [["deal with a situation", "kw-red"]],
  "come by": [["make a short visit", "kw-red"]],
  "add up": [["increase to a large total", "kw-red"]],
  "assume": [["accept as true without proof", "kw-red"]],
  "annual": [["yearly", "kw-red"]],
  "receipt": [["proof of payment", "kw-red"]],
  "herd": [["group of same-type animals", "kw-red"]],
}

export const CHINESE_DEF_MAP_5B: Record<string, string> = {
  "stress": "精神压力;忧虑",
  "breathe": "呼吸",
  "comfortable": "自在的;放松愉快的",
  "diet": "日常饮食",
  "fit": "健康强壮的",
  "mind": "注意力;心思",
  "emotional": "情感的;与感情有关的",
  "energetic": "精力充沛的;充满活力的",
  "muscle": "肌肉",
  "physical": "身体的;肉体的",
  "sense": "感官;感觉能力",
  "sore": "疼痛的",
  "stream": "小溪;溪流",
  "pain": "疼痛",
  "tense": "紧张的;无法放松的",
  "sprinter": "短跑运动员",
  "disability": "残障;残疾",
  "stroke": "轻抚;抚摸",
  "scented": "芳香的;有香味的",
  "active": "活跃的;好动的",
  "anxious": "焦虑的;担忧的",
  "brain": "脑;大脑",
  "depressed": "十分沮丧的;消沉绝望的",
  "memory": "记忆力",
  "produce": "产生;引起",
  "satisfied": "满意的;满足的",
  "suffer": "遭受病痛;受苦",
  "cell": "细胞",
  "bring out": "推出;出版",
  "catch on": "流行起来;受欢迎",
  "mood": "心情;情绪",
  "self-confident": "自信的",
  "belong": "应在某处;适合放在某处",
  "benefit": "益处;好处",
  "negative": "不良的;有害的",
  "positive": "良好的;有益的",
  "exhausted": "筋疲力尽的;疲惫不堪的",
  "upset": "难过的;心烦的",
  "text": "发短信给",
  "vitamin": "维生素",
  "sophisticated": "精密的;复杂先进的",
  "copy": "复制品;副本",
  "exhibition": "展览;展出物",
  "graffiti": "涂鸦",
  "landscape": "风景画;风景画法",
  "original": "原作;原件",
  "abandoned": "被遗弃的;废弃的",
  "community": "社区;同一地区的居民",
  "dull": "无聊的;乏味的",
  "mural": "壁画",
  "permission": "许可;准许",
  "public": "公共的;公众可使用的",
  "pipe": "管子;管道",
  "urban": "城市的;城镇的",
  "aim": "旨在;以……为目标",
  "portrait": "肖像;肖像画",
  "scene": "场景画;场景照片",
  "alley": "小巷;胡同",
  "decorate": "装饰;装点",
  "limit to": "限制在;限定于",
  "individual": "个人;个体",
  "donate": "捐赠;捐献",
  "motivate": "激励;促使",
  "opportunity": "机会;时机",
  "instrument": "乐器",
  "orchestra": "管弦乐队",
  "perform": "表演;演出",
  "saxophone": "萨克斯管",
  "tune": "曲调;旋律",
  "violin": "小提琴",
  "proud": "自豪的;骄傲的",
  "resident": "居民;住户",
  "resource": "资源;物资",
  "run out (of)": "用完;耗尽",
  "cello": "大提琴",
  "compose": "作曲;创作音乐",
  "rhythm": "节奏;韵律",
  "offer": "提供（机会等）",
  "sketch": "素描;速写",
  "represent": "体现;表达",
  "repair": "修理;修补",
  "process": "过程;步骤",
  "architecture": "建筑学;建筑设计",
  "slip": "滑倒;失足",
  "flippers": "游泳脚蹼",
  "gloves": "手套",
  "goggles": "护目镜;游泳镜",
  "lifejacket": "救生衣",
  "parachute": "降落伞",
  "get the hang of": "掌握窍门;学会使用",
  "harness": "安全带;保护用的带子",
  "instructor": "教练;指导员",
  "lean": "倾斜;俯身",
  "risk": "风险;危险发生的可能性",
  "simply": "只需;不过",
  "wetsuit": "湿式潜水服;防寒泳衣",
  "extreme sport": "极限运动",
  "attach": "系上;固定;连接",
  "propel": "推动;推进",
  "abseiling": "绳索下降运动;沿绳下攀",
  "edge": "边缘;边界",
  "fear": "恐惧;害怕",
  "strength": "体力;力量;勇气;毅力",
  "timing": "时机;时间的选择",
  "tradition": "传统;习俗",
  "wave": "海浪;波浪",
  "cliff": "悬崖;峭壁",
  "steep": "陡峭的;坡度大的",
  "pause": "暂停;停顿",
  "blast": "炸开;炸毁",
  "form": "组建;成立",
  "tide": "潮汐;潮水",
  "errand": "差事;跑腿的任务",
  "beat": "打败;战胜",
  "challenge": "挑战;考验能力的任务",
  "deal with": "处理;解决",
  "score": "比分;得分",
  "surf": "冲浪",
  "carry on": "传承;使继续",
  "iron": "熨;熨平",
  "participate": "参加;参与",
  "participant": "参加者;参与者",
  "wrinkle": "褶皱;皱褶",
  "nickname": "绰号;昵称",
  "specialise (AmE specialize)": "专门从事;专门研究",
  "analyse (AmE analyze)": "分析;仔细研究",
  "device": "装置;设备",
  "habitat": "栖息地;生长环境",
  "impact": "重大影响;强烈作用",
  "maintain": "维持;保持",
  "coral reef": "珊瑚礁",
  "ecosystem": "生态系统",
  "endangered": "濒危的;有灭绝危险的",
  "keep track of": "掌握动态;了解去向",
  "marine": "海洋的;海生的",
  "shell": "壳;外壳",
  "assess": "评估;评价",
  "bleach": "漂白;使褪色;变白",
  "pirate": "海盗",
  "sink": "击沉;使船沉没",
  "steal": "偷;窃取",
  "capture": "俘获;捕获",
  "disaster": "灾难;灾祸",
  "horrible": "极坏的;令人不快的",
  "artefact": "人工制品;文物",
  "fort": "堡垒;要塞",
  "goods": "商品;货物",
  "harbour (AmE harbor)": "海港;港湾",
  "strike": "突然袭击;突然发生并造成危害",
  "wrongdoing": "违法行为;不诚实的行为",
  "punishment": "惩罚;处罚",
  "trade": "做生意;进行贸易",
  "realise (AmE realize)": "意识到;认识到",
  "jump": "猛增;大幅上涨",
  "behave": "举止得体;表现规矩",
  "bizarre": "奇异的;古怪的",
  "vampire": "吸血鬼",
  "in the meantime": "在此期间;与此同时",
  "yeti": "雪人;喜马拉雅山雪人",
  "echolocation": "回声定位",
  "blind": "失明的;看不见的",
  "abominable": "令人憎恶的;令人恐惧的",
  "bacteria": "细菌（复数）",
  "prey": "猎物;被捕食的动物",
  "muscular": "肌肉的;与肌肉有关的",
  "bioluminescence": "生物发光",
  "text message": "短信",
  "abbreviation": "缩写;缩略形式",
  "character": "字符;字母;符号",
  "punctuation": "标点符号的使用;标点",
  "symbol": "符号;记号",
  "type": "打字;键入",
  "communicate": "交流;沟通",
  "joke": "开玩笑;说笑",
  "on purpose": "故意地;有意地",
  "poem": "诗;诗歌",
  "publish": "刊登;发表",
  "suggest": "建议;提议",
  "pack": "群（共同猎食的动物）",
  "site": "网站",
  "poet": "诗人",
  "fake": "假的;伪造的",
  "express (oneself)": "表达自己的想法或感受;表达自己",
  "identify": "识别;认出",
  "indicate": "指示;表明",
  "signal": "信号;暗号",
  "whistle": "口哨声",
  "affection": "喜爱;关爱",
  "command": "命令;指令",
  "complex": "复杂的;难懂的",
  "bite": "咬;咬的一口",
  "vocal": "嗓音的;与嗓音有关的",
  "click": "咔嗒声",
  "pop": "砰的一声;爆裂声",
  "aggressive": "好斗的;咄咄逼人的",
  "imitate": "模仿;仿效",
  "relationship": "关系;相处方式",
  "unique": "独一无二的;唯一的",
  "define": "解释;给……下定义",
  "blow": "吹;吹气",
  "pro": "赞成的理由;支持的论点",
  "con": "反对的理由;反对的论点",
  "instant message": "即时消息",
  "charge": "费用;收费金额",
  "connection": "情感联系;感情上的默契",
  "customer service": "客户服务部门;客服部",
  "order": "订购;预订",
  "value": "价值;重要性",
  "bargain": "讨价还价;商议条件",
  "budget": "精打细算;规划开支",
  "deserve": "应得;值得",
  "independent": "独立的;不依赖他人的",
  "manage": "合理使用;管理",
  "allowance": "零用钱;定期给的钱;补贴",
  "appreciate": "理解价值;认识到重要性",
  "chore": "家务;日常小任务",
  "hand": "递;交给",
  "earn": "挣钱;赚取",
  "receive": "收到;接受",
  "for": "支持;赞成",
  "against": "对…不利;不利于",
  "recognise (AmE recognize)": "承认;意识到",
  "reward": "奖励;奖赏",
  "barter": "以物易物;物物交换",
  "minted": "新制的;新创造的",
  "per cent (AmE percent)": "百分之",
  "debate": "辩论;讨论",
  "argument": "论据;理由",
  "access": "获取;使用",
  "cattle": "牛;牛群",
  "exchange": "交换;互换",
  "credit card": "信用卡",
  "currency": "货币;货币制度",
  "note": "纸币;钞票",
  "germ": "病菌;致病微生物",
  "weapon": "武器;兵器",
  "spear": "矛;长矛",
  "extra": "额外的;附加的",
  "international": "国际的;涉及多国的",
  "standard": "标准的;符合规定标准的",
  "wheat": "小麦;小麦籽粒",
  "cash": "现金;现款",
  "coin": "硬币",
  "cashpoint": "自动取款机",
  "queue": "排队等候",
  "prop": "道具",
  "host": "主办;举办",
  "arrange": "安排;筹划",
  "star-gazing": "观星;观察星空",
  "constellation": "星座",
  "invite over": "邀请到家里来",
  "script": "剧本;稿子",
  "household": "家庭的;家用的",
  "face": "面对;面临",
  "come by": "顺便来访;短暂拜访",
  "add up": "逐渐积累;积少成多",
  "assume": "假定;想当然地认为",
  "annual": "每年的;一年一次的",
  "receipt": "收据;购物小票",
  "herd": "兽群;畜群",
}

// Repeated words can have different senses in different lessons (aim / benefit).
const LESSON_METADATA_5B: Record<string, Pick<WordEntry, 'chineseDef' | 'keywords'>> = {
  "Unit 9::Lesson 2::aim": {"chineseDef": "目标;目的", "keywords": [["purpose", "kw-red"]]},
  "Unit 10::Lesson 2::benefit": {"chineseDef": "使受益;对某人有益", "keywords": [["improve lives", "kw-red"]]},
}

export const SAMPLE_WORDS_5B: WordEntry[] = _RAW_WORDS_5B.map(w => ({
  ...w,
  chineseDef: CHINESE_DEF_MAP_5B[w.word] ?? undefined,
  syllables: SYLLABLE_MAP_5B[w.word.toLowerCase()] ?? undefined,
  keywords: KW_MAP_5B[w.word] ?? undefined,
  ...(LESSON_METADATA_5B[`${w.unit}::${w.lesson}::${w.word}`] ?? {}),
}))
