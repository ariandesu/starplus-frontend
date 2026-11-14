# Usability test: STAR PLUS

Two parts:

1. **Expert walkthrough (done, 2026-11-14).** One reviewer (Claude, an AI assistant) worked through
   the live demo as the Astronaut. This is an expert review, **not a test with users**: it finds
   likely problems but says nothing about real success rates or times.
2. **User test (to run).** A 15-minute session per person, with 3 to 5 people outside the team.
   Fill in the results table at the end with what you actually observe.

---

## Part 1. Expert walkthrough (2026-11-14)

Setup: https://starplus-frontend.vercel.app, Astronaut demo card, desktop browser.

| # | Task | What happened | Severity |
|---|---|---|---|
| A | Find which measures need attention and what to do about them | Home shows "2 measures to watch" (heart rate 112 bpm, systolic 141 mmHg), but the cards and the "Overall: Watch" panel are **not links**. The "What to do" text is on the result page, which is only reachable through History, below 22 charts (about 8,000 px down) in "Past results". **Fixed 2026-11-14** ([#5](https://github.com/ariandesu/starplus-frontend/pull/5)): each tile opens the result it came from, and the status panel links to the latest result ("See your result and what to do"). Checked on the live demo: the heart rate tile opens "Your result" with its "What to do". | ~~Major~~ Fixed |
| B | Start today's check | Clear: "Start today's check" opens one measure per screen, with how to measure and a normal range. Home also has "Start self-check" next to it; the difference between the two buttons is not explained. | Minor |
| C | Check whether the latest glucose is inside the Inspiration4 crew range | Works once found: the band, its range and the NASA source are explained on the chart. The glucose chart is the 18th of 22 on History, and the filter has no "Vitals" option. | Moderate |
| D | A crewmate is not responding: find the first step | Excellent: the red Emergency button is on every screen, opens without login, and "Someone else, not responding" is the first choice. | None |
| E | Read today's progress | "Today's check: 0 of 11" on the status panel sits beside "Readiness 4/4 today, Check-in Done", which can look contradictory. | Minor |

Still open, in order: group History charts (vitals first) and add a "Vitals" filter (C); one line
under the two start buttons saying what each does (B); reword the readiness check-in item (E).
Done: link each "Measures to watch" card and the status panel to the result (A, #5).

---

## Part 2. User test (15 minutes per person)

**Who:** 3 to 5 people who did not build the app (classmates, family). No medical background needed.

**Setup:** open https://starplus-frontend.vercel.app/login on a phone or laptop. Tap **Astronaut**,
then **Login**. The demo holds synthetic data and resets every night, so saving readings is fine.

**How to run it:**

* Say: "We are testing the app, not you. Please think out loud. I can't help during the tasks."
* Read one task at a time. Start a timer when you finish reading, stop it when they say "done" or
  give up (cap each task at 3 minutes).
* Note: completed without help (Y), with a hint (H), or not completed (N); the time; and anything
  they say or where they hesitate.

**Tasks** (read them exactly as written):

1. "You are Alex, an astronaut on the ISS. Which of your measurements need attention today, and what
   should you do about your heart rate?"
   *Success:* names heart rate and systolic blood pressure, and finds "Tell the crew medical officer".
2. "Record today's heart rate. Use 72."
   *Success:* the value is saved in Today's check.
3. "Is your latest blood glucose inside the range measured on NASA's Inspiration4 crew?"
   *Success:* finds the shaded band on the glucose chart and answers yes or no correctly.
4. "Your crewmate has collapsed and is not responding. What does the app tell you to do first?"
   *Success:* reaches the first step of "Someone else, not responding".
5. "Log out. Sign in as the Flight Medical Officer and find which crew member is in a critical state."
   *Success:* names Mia Chen.

**After the tasks:** ask them to fill in the System Usability Scale (SUS, John Brooke, 1986; free to
use with credit). Each statement is answered 1 (strongly disagree) to 5 (strongly agree).

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

**SUS score:** for odd items subtract 1 from the answer; for even items subtract the answer from 5.
Add the ten numbers and multiply by 2.5, giving 0 to 100. About 68 is the usual average benchmark.

Finally ask: "What was the most confusing moment?" and "What would you change first?"

---

## Results (fill in with what you observe)

| Person | Device | T1 | T2 | T3 | T4 | T5 | SUS | Most confusing moment |
|---|---|---|---|---|---|---|---|---|
| P1 | | / s | / s | / s | / s | / s | | |
| P2 | | / s | / s | / s | / s | / s | | |
| P3 | | / s | / s | / s | / s | / s | | |
| P4 | | / s | / s | / s | / s | / s | | |
| P5 | | / s | / s | / s | / s | / s | | |

Write each task cell as result / time, for example "Y / 42 s". Then add a summary: tasks completed
without help (out of 25), median time per task, mean SUS, and the changes you made because of it.
