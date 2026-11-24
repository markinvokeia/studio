# La agenda en inglés

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/50-english.spec.ts`

La batería en inglés (app en inglés): atómicos, encadenados, IA, incompletos.

**131 frases** en **88 pruebas que pasan** (es 0 · es-ES 0 · en 131 · 4 contestadas por la IA simulada). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## EN-N1.1 · Listening

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-001 with Voice on it hears everything, no wake word | en | `/appointments` | «go to tomorrow» | Calendar on Tue 24/11. |
| VZ-EN-002 «Invoke» alone says it is listening | en | `/appointments` | «Invoke» | **Voice command** · I'm listening. Tell me what to do. |
| VZ-EN-004 falls asleep with an open question and resumes it | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «the second one» | **Appointment** · Ana Martínez's appointment, today at 10:30. |

## EN-N1.2 · Navigation and views

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-010 today | en | `/appointments` | «today» | Calendar on Mon 23/11. |
| VZ-EN-011 next (week view → +1 week) | en | `/appointments` | «next» | Calendar on Mon 30/11. |
| VZ-EN-012 previous in day view | en | `/appointments` | «day view» | **Calendar** · Done, day view. |
| 〃 | en | `/appointments` | «previous» | Calendar on Sun 22/11. |
| VZ-EN-013 next week (lands on next week) | en | `/appointments` | «next week» | Calendar on Mon 30/11. |
| VZ-EN-014 go to December 3rd | en | `/appointments` | «go to December 3» | Calendar on Thu 03/12. |
| VZ-EN-02x «day view» → day | en | `/appointments` | «day view» | **Calendar** · Done, day view. |
| VZ-EN-02x «week view» → week | en | `/appointments` | «week view» | **Calendar** · Done, week view. |
| VZ-EN-02x «3 day view» → 3-day | en | `/appointments` | «3 day view» | **Calendar** · Done, 3 days view. |
| VZ-EN-02x «month view» → month | en | `/appointments` | «month view» | **Calendar** · Done, month view. |
| VZ-EN-02x «list view» → schedule | en | `/appointments` | «list view» | **Calendar** · Done, schedule view. |
| VZ-EN-026 «which views are there» + «the last one» | en | `/appointments` | «which views are there» | **Options** · Which view do you want? [day / 2 days / 3 days / 4 days / 5 days / 6 days] |
| 〃 | en | `/appointments` | «the last one» | **Options** · Done, schedule view. |

## EN-N1.3 · Zoom

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-03x «zoom in» → 1.1 | en | `/appointments` | «zoom in» | Zoom at 110%. |
| VZ-EN-03x «zoom out» → 0.9 | en | `/appointments` | «zoom out» | Zoom at 90%. |
| VZ-EN-03x «max zoom» → 2.5 | en | `/appointments` | «max zoom» | Zoom at 250%. |
| VZ-EN-03x «zoom all the way out» → 0.3 | en | `/appointments` | «zoom all the way out» | Zoom at 30%. |
| VZ-EN-03x «zoom to 150 percent» → 1.5 | en | `/appointments` | «zoom to 150 percent» | Zoom at 150%. |
| VZ-EN-03x «bigger» → 1.1 | en | `/appointments` | «bigger» | Zoom at 110%. |
| VZ-EN-03x «smaller» → 0.9 | en | `/appointments` | «smaller» | Zoom at 90%. |
| VZ-EN-037 reset zoom | en | `/appointments` | «max zoom» | Zoom at 250%. |
| 〃 | en | `/appointments` | «reset zoom» | Zoom at 100%. |

## EN-N1.4 · Calendars, doctors, panel, search

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-040 «which calendars are there» + «the second one» | en | `/appointments` | «which calendars are there» | **Options** · Which calendar? [Sillón 1 / Sillón 2 / Ortodoncia] |
| 〃 | en | `/appointments` | «the second one» | **Options** · Done, only Sillón 2. |
| VZ-EN-041 «only Dr. Pérez» | en | `/appointments` | «only doctor Pérez» | **Calendar filters** · Done, only Dr. Martín Pérez. |
| VZ-EN-042 open the calendars panel | en | `/appointments` | «open the calendars panel» | **Calendars panel** · Done, I opened the calendars panel. |
| VZ-EN-043 pin the panel | en | `/appointments` | «pin the panel» | **Calendars panel** · Done, the calendars panel stays pinned. |
| VZ-EN-044 unpin the sidebar | en | `/appointments` | «pin the panel» | **Calendars panel** · Done, the calendars panel stays pinned. |
| 〃 | en | `/appointments` | «unpin the sidebar» | **Calendars panel** · Done, the calendars panel hides itself after picking a calendar. |
| VZ-EN-045 search Ana Gómez | en | `/appointments` | «search Ana Gómez» | **Find appointment** · Searching for “ana gomez”. |
| VZ-EN-046 refresh | en | `/appointments` | «refresh» | **Refresh** · Done, I refreshed the calendar. |
| VZ-EN-047 what do I have today | en | `/appointments` | «what do I have today» | **Schedule · Mon 23/11** · 4 appointments today. |

## EN-N1.5 · Settings

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-050 open the settings | en | `/appointments` | «open the settings» | **Calendar settings** · Done, I opened the settings. |
| VZ-EN-051 Invoke mode | en | `/appointments` | «switch to invoke mode» | **Calendar settings** · Done: Invoke mode. |
| VZ-EN-052 custom mode | en | `/appointments` | «switch to invoke mode» | **Calendar settings** · Done: Invoke mode. |
| 〃 | en | `/appointments` | «custom mode» | **Calendar settings** · Done: custom mode. |
| VZ-EN-053 default view week | en | `/appointments` | «default view month» | **Calendar settings** · Done: default view month. |
| VZ-EN-054 hour height 120 | en | `/appointments` | «hour height 120» | **Calendar settings** · Done: hour height 120 px. |
| VZ-EN-055 taller hours | en | `/appointments` | «taller hours» | **Calendar settings** · Done: hour height 100 px. |
| VZ-EN-056 10 minute slots | en | `/appointments` | «10 minute slots» | **Calendar settings** · Done: 10-minute slots. |
| VZ-EN-057 default site Pocitos | en | `/appointments` | «default site Pocitos» | **Calendar settings** · Done: default site Pocitos. |
| VZ-EN-058 label time, patient and notes | en | `/appointments` | «label time patient and notes» | **Calendar settings** · Done: label: time, patient and notes. |
| VZ-EN-059 hide weekends | en | `/appointments` | «hide weekends» | **Calendar settings** · Done: hidden: Saturday, Sunday. |
| VZ-EN-060 show Saturdays | en | `/appointments` | «hide weekends» | **Calendar settings** · Done: hidden: Saturday, Sunday. |
| 〃 | en | `/appointments` | «show saturdays» | **Calendar settings** · Done: hidden: Sunday. |
| VZ-EN-061 clinic hours | en | `/appointments` | «show clinic hours» | **Calendar settings** · Done: clinic hours visible. |
| VZ-EN-062 visible hours from 8 to 6 | en | `/appointments` | «visible hours from 8 to 6» | **Calendar settings** · Done: visible hours 08:00 to 18:00. |
| VZ-EN-063 full day | en | `/appointments` | «show clinic hours» | **Calendar settings** · Done: clinic hours visible. |
| 〃 | en | `/appointments` | «visible hours full day» | **Calendar settings** · Done: full day visible. |
| VZ-EN-064 «turn off color by status» → color_by_status false | en | `/appointments` | «turn off color by status» | **Calendar settings** · Done: color by status off. |
| VZ-EN-064 «turn on availability check» → check_availability true | en | `/appointments` | «turn on availability check» | **Calendar settings** · Done: check availability on. |
| VZ-EN-064 «block out of hours» → block_unavailable true | en | `/appointments` | «block out of hours» | **Calendar settings** · Done: block out-of-hours time on. |
| VZ-EN-064 «filter doctors by service» → filter_doctors_by_service true | en | `/appointments` | «filter doctors by service» | **Calendar settings** · Done: filter doctors by service on. |
| VZ-EN-064 «turn on inline creation» → inline_appointment_creation true | en | `/appointments` | «turn on inline creation» | **Calendar settings** · Done: create appointments on the calendar on. |
| VZ-EN-064 «turn on live preview» → inline_draft_live_preview true | en | `/appointments` | «turn on live preview» | **Calendar settings** · Done: live preview on. |

## EN-N1.6 · Appointments

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-070 «Juan Pérez's appointment» selects it | en | `/appointments` | «show me Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| VZ-EN-071 «the appointment at 3» by time | en | `/appointments` | «go to the appointment at 3» | **Appointment** · Carlos López's appointment, today at 15:00. |
| VZ-EN-07x «Juan Pérez arrived» → arrived | en | `/appointments` | «Juan Pérez arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |
| VZ-EN-07x «Carlos López confirmed» → confirmed | en | `/appointments` | «Carlos López confirmed» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Confirmed. |
| VZ-EN-07x «Carlos López is a no show» → no_show | en | `/appointments` | «Carlos López is a no show» | **Appointment status** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now No-show. |
| VZ-EN-07x «mark Carlos López as completed» → completed | en | `/appointments` | «mark Carlos López as completed» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Completed. |
| VZ-EN-076 «no» keeps it | en | `/appointments` | «Juan Pérez arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «no» | **Appointment status** · OK, I didn't change anything. |
| VZ-EN-077 delete Carlos López's appointment | en | `/appointments` | «delete Carlos López's appointment» | **Delete appointment** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Delete appointment** · Done, I deleted Carlos López’s appointment. |
| VZ-EN-078 make Juan's appointment red | en | `/appointments` | «make Juan Pérez's appointment red» | **Appointment color** · Say “yes” to do it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment color** · Done, Juan Pérez’s appointment is now red. |
| VZ-EN-079 open Juan Pérez's account | en | `/appointments` | «open Juan Pérez's account» | **Account statement** · I opened Account statement for Juan Pérez. |

## EN-N1.7 · Form, export, patients

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-080 edit opens the form | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| VZ-EN-081 with Dr. Gómez | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «with doctor Gómez» | **Edit appointment** · Done: with Dr. Pablo Gómez. Save it? |
| VZ-EN-082 at 11:30 | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «at 11 30» | **Edit appointment** · Done: today at 11:30. Save it? |
| VZ-EN-083 ends at 11 | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «ends at 11» | **Edit appointment** · Done: ends at 11:00. Save it? |
| VZ-EN-084 in chair 1 | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «in chair 1» | **Edit appointment** · Done: room Sillón 1. Save it? |
| VZ-EN-085 note: bring X-rays | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «note: bring X-rays» | **Edit appointment** · Done: note “Bring X-rays”. Save it? |
| VZ-EN-086 patient is Sofía Castro | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «patient is Sofía Castro» | **Edit appointment** · Done: patient Sofía Castro. Save it? |
| VZ-EN-087 save | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «save» | **Edit appointment** · Done, appointment updated. |
| VZ-EN-088 cancel closes without saving | en | `/appointments` | «edit Juan Pérez's appointment» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «cancel» | **Edit appointment** · Done, I closed the form without saving. |
| VZ-EN-090 export next week schedule | en | `/appointments` | «export the schedule for next week» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| 〃 | en | `/appointments` | «yes» | **Export schedule** · Done, the schedule was downloaded. |
| VZ-EN-091 export all calendars | en | `/appointments` | «export the schedule for all calendars» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| VZ-EN-092 find patient Juan Pérez | en | `/appointments` | «find patient Juan Pérez» | **Find patient** · I found Juan Pérez: their last appointment was today at 10:00. |
| VZ-EN-093 find patient with no appointments (widget) | en | `/appointments` | «find patient Sofía Castro» | **Find patient** · Done, I opened Sofía Castro's record. |
| VZ-EN-094 not found by name → asks ID/email/phone | en | `/appointments` | «find patient Ernest Valverde» | **Find patient** · I couldn't find ernest valverde by name. Tell me the ID number, email or phone. |
| 〃 | en | `/appointments` | «phone 099 123 456» | **Find patient** · Done, I opened Sofía Castro's record. |
| VZ-EN-095 summarize this patient (focus) from their records | en | `/appointments` | «Juan Pérez's appointment» | **Appointment** · Juan Pérez's appointment, today at 10:00. |
| 〃 | en | `/appointments` | «summarize this patient» | Patient information |

## EN-N2 · Chained

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-100 select → «mark it as arrived» → yes | en | `/appointments` | «Carlos López's appointment» | **Appointment** · Carlos López's appointment, today at 15:00. |
| 〃 | en | `/appointments` | «mark it as arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Arrived. |
| VZ-EN-101 two «Ana»: «the one at 10 30» | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «the one at 10 30» | **Appointment** · Ana Martínez's appointment, today at 10:30. |
| VZ-EN-102 a tool in the middle does not cancel the question | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «zoom in please» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «the first one» | **Appointment** · Ana Gómez's appointment, today at 09:00. |
| VZ-EN-103 a new request asks whether to drop the task; «yes» does it | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «export the schedule for next week» | **Switch tasks?** · We were on “Ana's appointment”. Should I drop it to do “export the schedule for next week”? |
| 〃 | en | `/appointments` | «yes» | **Export schedule** · Should I download it? Say “yes”, or change the period or the calendars. |
| VZ-EN-104 «never mind» cancels | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «never mind» | **Voice command** · Done, I dropped it. |

## EN-N3 · AI plans

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-110 «Juan's appointment, mark him arrived and open his account» | en | `/appointments` | «Juan's appointment, mark him arrived and open his account» · IA | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Account statement** · I opened Account statement for Juan Pérez. |
| VZ-EN-111 «make everything way bigger, I can barely see» → zoom ×3 | en | `/appointments` | «make everything way bigger I can barely see» · IA | Zoom at 130%. |
| VZ-EN-112 the AI answers an open question («the later one») | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «I would say the later one of the two» · IA | **Appointment** · Ana Martínez's appointment, today at 10:30. |
| VZ-EN-113 room small talk is ignored | en | `/appointments` | «Ana's appointment» | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |
| 〃 | en | `/appointments` | «could you bring me a coffee when you can» · IA | **Appointment** · Which of these appointments? [Mon 23/11 09:00 · Ana Gómez / Mon 23/11 10:30 · Ana Martínez] |

## EN-N4 · Incomplete or misheard

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| VZ-EN-120 «edit the appointment» without saying which: asks | en | `/appointments` | «edit the appointment» | **Edit appointment** · Which appointment? Say the patient or the time. |
| 〃 | en | `/appointments` | «Carlos López's» | **Edit appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| VZ-EN-121 nonsense: shows examples and keeps working | en | `/appointments` | «blah blah tralala» | **I didn't understand the request** · I didn’t understand what to do. Try, for example: “go to Thursday”, “what do I have tomorrow?”, “Ana Gómez arrived”, “new appointment for Ana Gómez on Monday at 10”, “make Ana’s appointment red”, “block Monday from 2 to 4… |
| 〃 | en | `/appointments` | «day view» | **Calendar** · Done, day view. |
| VZ-EN-122 «Juan Peres arrived» (misspelled) still finds him | en | `/appointments` | «Juan Peres arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |

## EN-SERVICE · English dental terms with a Spanish catalog

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «cleaning» is «Limpieza»; «change the time to 11 am» corrects; «yes» saves | en | `/appointments` | «new appointment for Sofía Castro tomorrow at 10 with doctor Pérez, cleaning» | **New appointment** · Check the form. “Yes” saves it; “no” leaves it open. You can also correct it: “with doctor Smith”, “add cleaning”, “remove the consultation”, “at 11”. |
| 〃 | en | `/appointments` | «change the time to 11 am» | **New appointment** · Done: tomorrow at 11:00. Save it? |
| 〃 | en | `/appointments` | «yes» | **New appointment** · Done, appointment saved. |

## Pruebas sin frase por el micrófono

Estas pruebas pasan sin decir una frase por el micrófono: le dan la frase directo al intérprete y verifican qué entendió (el título la trae; «no:» quiere decir que ese intérprete no la toma porque es de otro comando, y eso también es lo probado), o prueban el micrófono y piezas sueltas.

- EN-N1.1 · Listening › VZ-EN-003 tapping Voice turns it off

