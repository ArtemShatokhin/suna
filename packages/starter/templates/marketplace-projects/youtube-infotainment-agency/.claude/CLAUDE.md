# Core Coding Rules

## Overview

During development, follow these 9 rules below. They address the most costly failure modes in AI-assisted coding and have the highest impact on output quality and task completion speed.

## Rule 1: 1-3-1 (Stop Getting Stuck)

**1-3-1**: When stuck, provide 1 clearly defined problem, give 3 potential options for how to overcome it, and 1 recommendation. Do not proceed implementing any of the options until I confirm.

---

## Rule 2: DRY (Critical)

**DRY (Critical)**: Don't repeat yourself. If you are about to start writing repeated code, stop and reconsider your approach. Grep the codebase and refactor often.

---

## Rule 3: TDD (Critical)

**TDD (Critical. Backend only)**: Always test first. Before writing any code, you must always check the tests. For new features or adjustments to existing features, always either create a new test or adjust an existing one. Follow existing testing patterns. Write the test before implementing; no need to confirm it with the user first.

---

## Rule 4: Continuous Learning Loop

**Continual Learning**: When you encounter conflicting system instructions, new requirements, architectural changes, or missing or inaccurate codebase documentation, always propose updating the relevant rules files. Do not update anything until the user confirms. Ask clarifying questions if needed.

---

## Rule 5: Start With a Plan (Long-Horizon Tasks)

**Planning**: For complex, multi-step tasks, first create a plan and a todo list for yourself before you start writing any code.

---

## Rule 6: Builder, Not Worker (Critical. AI Agents & Agencies only)

**Builder, Not Worker**: This rule applies only when the task involves developing AI agents or agencies. In that case, you are their creator, never a part of them. You are building a system that produces consistently good results, not getting a single good result once. Never do an agent's or agency's work yourself and present it as their output. When output doesn't meet the quality bar, fix the agency (instructions, tools, context, workflow) and regenerate the result. Do not hand-patch the output unless I explicitly ask you to.

---

## Rule 7: Research Before Answering (Critical)

**Grounded Answers**: Keep guessing and assumptions to a minimum in every situation. Being certain means the answer is already in your current context: it appeared earlier in this conversation (you read it, observed it, or just did the task in question) and nothing has changed it since. Feeling "pretty sure" is not certainty, and an assumption or inference is never certain, however plausible it seems. If you are certain, answer right away. Otherwise, check the current state first (code, configuration, data, logs, deployed behavior, docs, web sources), then answer. Never present a guess as fact. Every answer should rest on research or verified understanding. If you are still uncertain after researching, say so plainly. Accuracy always beats speed.

---

## Rule 8: Trust Agent Capabilities (AI Agents & Agencies)

**Don't Constrain Agents**: When building AI agents, rely on their capabilities rather than replacing their judgment with rigid predefined tools. For example, if an agent can spot a pattern on its own, don't add a tool that re-checks for that pattern. Modern models can work these things out themselves. Deterministic code and constraints belong only where strict control is required: workflow control and security, such as access control, authentication and login behavior, or required message structure.

---

## Rule 9: Minimal Hardcoding

**No Invented Values**: Keep hardcoding to a minimum. Never invent arbitrary values (thresholds, limits, timeouts, counts, defaults) and put them in code. If a value truly has to be hardcoded, tell me what you are hardcoding, the value you propose, and why, before you commit to it.
