# Review: Intelligent Playground marketing (PPTX + index.html)

Reviewed 2026-11-18 against `_build/content.md` (fact sources F1–F22), `_build/assets.md` and `funding/*.md`.
Deck re-rendered (`_build/ppt/render/slide-01..14.png`). HTML captured at 1440 px desktop (light and dark) and at a true 390 px width (iframe wrapper, because headless Chrome will not lay out narrower than 500 px).

## Summary
The facts are clean. Nothing from Robocoach appears (140 schools, ICT award, per-student price, EDB report export). 運球高手 is not mentioned, and there is no price, testimonial or customer name. The deck says 免費 only in an internal speaker-note reminder. Funding amounts, circular numbers and deadlines match the funding files. The privacy wording is correct: no video is uploaded, but the score record and a thumbnail avatar can be. There are no Simplified characters in the visible text. The only one is `等线` in the default font list of the PPT theme XML. At 390 px the page has no horizontal scroll and no broken images.

The main problem was privacy: several photos showed the pilot school's crest and full name on the kiosk screen.

## Issues fixed
| # | Where | Issue | Fix |
|---|---|---|---|
| 1 | assets (HTML + PPT) | The school crest and name 中華傳道會呂明才小學 / CNEC Lui Ming Choi PS could be read on the screen in `students-hall-high-knees`, `students-raise-hand-to-join`, `kiosk-wall-mounted-join-screen` and `students-hall-group-exercise`, and as a reflection in `kiosk-wall-mounted-menu`. A school name sign was on the pink display case in `kiosk-floor-standing-gameplay`, and a school poster appeared in that photo's on-screen camera feed. | Blurred those areas in place. The unblurred files are in `_build/originals/`. |
| 2 | PPT slide 6 | The 游泳健將 icon was cropped from the random-mode icon and included a diagonal stroke, so it looked like a "no swimming" sign. | Changed it to the FontAwesome swimmer. |
| 3 | PPT slide 6 | 平板支撐 reused the push-up icon. | It now uses the same plank line icon as the web page. |
| 4 | PPT slide 10 | The subtitle "PE · 體適能 · STEAM · AI 教育" did not match the four cards (體育課 / 體適能 / MVPA60 / AI 教育). | Changed it to 「體育課 · 體適能 · MVPA60 · AI 教育（STEAM）」. |
| 5 | PPT slide 9 vs HTML | The made-up dashboard KPIs did not match (412/186/27 vs 418/203/29). | Changed the PPT to 418 / 203 / 29. |
| 6 | PPT slide 12 | 「體育相關資訊科技服務、軟件」 was in quotation marks, which presents it as the circular's exact wording, but it is not. | Removed the quotation marks: MVPA60 津貼用途明列體育相關資訊科技服務及軟件. |
| 7 | HTML funding | 「…軟件及器材」 paraphrased the circular too loosely. | Changed it to follow circular 73/2024: 資訊科技服務、流動應用程式及軟件，以及體育活動套件和輔助工具. |
| 8 | PPT slide 13 | The timeline sat low on the slide, leaving a large empty band under the title. | Moved it up 0.5 in. |
| 9 | HTML hero (desktop) | The painted centre line ran through the lede paragraph and the English sub-line. | Moved the line into the column gap (56%) and removed it below 980 px, where the layout stacks. |
| 10 | HTML | A 1.2 MB 1024 px PNG was used for the favicon and the 40 px header logo. | Added `assets/mascot-icon-128.png` (30 KB) and pointed both at it. |

The coordinator removed the hero caption 「示範片段…」 separately. I did not re-add it. Its `.caption` CSS rule is now unused and harmless.

## Remaining (not fixed and needs judgement)
- **Children's faces:** `students-hall-high-knees.jpg` (HTML "why" section) shows a boy with glasses in clear side profile. `students-raise-hand-to-join.jpg` (HTML step 1) shows a smiling boy at the left edge. Both need school or parent consent before public use. Otherwise, swap them for face-free shots such as `kiosk-wall-mounted-menu` or `student-raise-hand-outdoor`.
- **Blur quality:** the blurred patches look like soft rectangles, most visibly on the pink display case in the floor-standing kiosk photo. Re-shooting the photos, or retouching them properly, would look better.
- **Hardware options:** the HTML offers 「可選落地式運動站、壁掛大屏或 iPad 版本」 and the photos show trolley, wall and floor-standing setups. content.md confirms only the RK3588 kiosk, the 1080p camera and the iPad. Confirm that all three mounting options are actually sold.
- **Dashboard visuals:** both deliverables use a made-up mock-up labelled 示意圖, with numbers, heatmap time slots and class names invented. No screenshot of the new dashboard design was available. Replace the mock-up with a real screenshot that uses dummy data when one exists.
- **PPT file size:** 12.5 MB, because images are embedded as PNG at 200 px/in to keep the rounded corners. This is fine to present but heavy for email. You could lower `PX` in `build.js` to 150.
- **Product team to confirm:** how 百米飛人 and 游泳健將 are played (deck notes and HTML grid), and outdoor use, screen size, space needed and network needs (left out of both deliverables).
- **Font:** the deck uses Microsoft JhengHei. QA renders swap in Heiti TC. Check the deck once on Windows or PowerPoint.

## Needs the user's input
1. Contact email and phone. They are placeholders `[聯絡電郵]` and `[聯絡電話]` in PPT slide 14 and in the HTML contact section, including the `mailto:` link and the form message.
2. A QR code or web URL for slide 14, which currently shows a "QR" placeholder.
3. Whether the on-site demo is free. 免費 has been left out of both deliverables until confirmed.
4. A product logo or wordmark. The mascot app icon is standing in for one.
5. A backend for the web form, which is not connected and tells visitors to email instead.
6. Consent for the student photos listed above, or approval to swap them.
7. Pricing stays as 按學校需要報價. Confirm that no indicative price should appear.
8. Partner school logos are in `assets/` but are not used anywhere, which is correct. Keep it that way unless the schools agree in writing.
