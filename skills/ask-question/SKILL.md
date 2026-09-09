---
name: Ask Question
description: Ask clarifying questions in one batch with A/B choices or A/B plus free-form C
metadata:
  attachtype: always
  version: "0.1.0"
---

# Ask Question

When you need input from the user, gather **every** clarifying question you need for the next steps, then ask them **in one** `ask_question` call (multiple items in `questions`). Do not ask one question, wait, then ask another unless a later answer truly unlocks a new unknown.

## Per question: binary choice (this or that)

Present exactly two options and ask the user to answer **A** or **B** (`allowFreeform: false`).

## Per question: more than two options

1. Pick the **top 2** best options and label them **A** and **B**.
2. Offer **C** as free-form: the user provides their own answer in text (`allowFreeform: true`).

Do not proceed until the user has answered the full batch.
