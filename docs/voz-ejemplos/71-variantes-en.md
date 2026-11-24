# Variantes en inglés

[← Índice de ejemplos](README.md) · Pruebas: `e2e/tests/voice-agent/71-variants-en.spec.ts`

La misma acción pedida de muchas formas, en inglés.

**219 frases** en **192 pruebas que pasan** (es 0 · es-ES 0 · en 219). Pantallas: `/appointments`.

Cada fila es una frase dicha por el micrófono, en orden. **Prueba** es lo que se verifica; **Respondió** es lo que mostró la tarjeta de voz después de esa frase. «IA» marca las frases que entendió la IA (en la prueba su respuesta está simulada; el resto lo entiende el navegador solo).

## V-EN-NAV · today / tomorrow / yesterday

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «today» | en | `/appointments` | «today» | Calendar on Mon 23/11. |
| «go to today» | en | `/appointments` | «go to today» | Calendar on Mon 23/11. |
| «back to today» | en | `/appointments` | «back to today» | Calendar on Mon 23/11. |
| «show me today» | en | `/appointments` | «show me today» | Calendar on Mon 23/11. |
| «jump to today» | en | `/appointments` | «jump to today» | Calendar on Mon 23/11. |
| «take me to today» | en | `/appointments` | «take me to today» | Calendar on Mon 23/11. |
| «tomorrow» | en | `/appointments` | «tomorrow» | Calendar on Tue 24/11. |
| «go to tomorrow» | en | `/appointments` | «go to tomorrow» | Calendar on Tue 24/11. |
| «show me tomorrow» | en | `/appointments` | «show me tomorrow» | Calendar on Tue 24/11. |
| «what about tomorrow» | en | `/appointments` | «what about tomorrow» | Calendar on Tue 24/11. |
| «yesterday» | en | `/appointments` | «yesterday» | Calendar on Sun 22/11. |
| «go to yesterday» | en | `/appointments` | «go to yesterday» | Calendar on Sun 22/11. |
| «show me yesterday» | en | `/appointments` | «show me yesterday» | Calendar on Sun 22/11. |

## V-EN-NAV · next / previous (week view)

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «next» | en | `/appointments` | «next» | Calendar on Mon 30/11. |
| «forward» | en | `/appointments` | «forward» | Calendar on Mon 30/11. |
| «go forward» | en | `/appointments` | «go forward» | Calendar on Mon 30/11. |
| «next one» | en | `/appointments` | «next one» | Calendar on Mon 30/11. |
| «move ahead» | en | `/appointments` | «move ahead» | Calendar on Mon 30/11. |
| «previous» | en | `/appointments` | «previous» | Calendar on Mon 16/11. |
| «back» | en | `/appointments` | «back» | Calendar on Mon 16/11. |
| «go back» | en | `/appointments` | «go back» | Calendar on Mon 16/11. |
| «backward» | en | `/appointments` | «backward» | Calendar on Mon 16/11. |
| «previous one» | en | `/appointments` | «previous one» | Calendar on Mon 16/11. |

## V-EN-NAV · weeks and months

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «next week» | en | `/appointments` | «next week» | Calendar on Mon 30/11. |
| «go to next week» | en | `/appointments` | «go to next week» | Calendar on Mon 30/11. |
| «show me next week» | en | `/appointments` | «show me next week» | **Calendar** · Done, week view. |
| «last week» | en | `/appointments` | «last week» | Calendar on Mon 16/11. |
| «previous week» | en | `/appointments` | «previous week» | Calendar on Mon 16/11. |

## V-EN-NAV · months

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «next month» | en | `/appointments` | «next month» | Calendar on Sat 26/12. |
| «go to next month» | en | `/appointments` | «go to next month» | Calendar on Sat 26/12. |
| «last month» | en | `/appointments` | «last month» | Calendar on Fri 23/10. |
| «previous month» | en | `/appointments` | «previous month» | Calendar on Mon 26/10. |

## V-EN-NAV · weekdays

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «go to Thursday» | en | `/appointments` | «go to Thursday» | Calendar on Thu 26/11. |
| «Monday» | en | `/appointments` | «Monday» | Calendar on Mon 23/11. |
| «show me Friday» | en | `/appointments` | «show me Friday» | Calendar on Fri 27/11. |
| «jump to Tuesday» | en | `/appointments` | «jump to Tuesday» | Calendar on Tue 24/11. |
| «on Wednesday» | en | `/appointments` | «on Wednesday» | Calendar on Wed 25/11. |
| «this Saturday» | en | `/appointments` | «this Saturday» | Calendar on Sat 28/11. |

## V-EN-NAV · dates

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «go to December 3» | en | `/appointments` | «go to December 3» | Calendar on Thu 03/12. |
| «December 3rd» | en | `/appointments` | «December 3rd» | Calendar on Thu 03/12. |
| «the 15th» | en | `/appointments` | «the 15th» | Calendar on Sun 15/11. |
| «jump to January 20» | en | `/appointments` | «jump to January 20» | Calendar on Wed 20/01. |
| «show me March 1st» | en | `/appointments` | «show me March 1st» | Calendar on Mon 01/03. |

## V-EN-VIEW

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «day view» | en | `/appointments` | «day view» | **Calendar** · Done, day view. |
| «daily view» | en | `/appointments` | «daily view» | **Calendar** · Done, day view. |
| «switch to day view» | en | `/appointments` | «switch to day view» | **Calendar** · Done, day view. |
| «show the day» | en | `/appointments` | «show the day» | **Calendar** · Done, day view. |
| «one day view» | en | `/appointments` | «one day view» | **Calendar** · Done, day view. |
| «week view» | en | `/appointments` | «week view» | **Calendar** · Done, week view. |
| «weekly view» | en | `/appointments` | «weekly view» | **Calendar** · Done, week view. |
| «switch to week view» | en | `/appointments` | «switch to week view» | **Calendar** · Done, week view. |
| «show the whole week» | en | `/appointments` | «show the whole week» | **Calendar** · Done, week view. |
| «month view» | en | `/appointments` | «month view» | **Calendar** · Done, month view. |
| «monthly view» | en | `/appointments` | «monthly view» | **Calendar** · Done, month view. |
| «switch to month» | en | `/appointments` | «switch to month» | **Calendar** · Done, month view. |
| «list view» | en | `/appointments` | «list view» | **Calendar** · Done, schedule view. |
| «agenda view» | en | `/appointments` | «agenda view» | **Calendar** · Done, schedule view. |
| «show it as a list» | en | `/appointments` | «show it as a list» | **Calendar** · Done, schedule view. |
| «2 day view» | en | `/appointments` | «2 day view» | **Calendar** · Done, 2 days view. |
| «three day view» | en | `/appointments` | «three day view» | **Calendar** · Done, 3 days view. |
| «4 day view» | en | `/appointments` | «4 day view» | **Calendar** · Done, 4 days view. |
| «5 days view» | en | `/appointments` | «5 days view» | **Calendar** · Done, 5 days view. |
| «six day view» | en | `/appointments` | «six day view» | **Calendar** · Done, 6 days view. |

## V-EN-ZOOM

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «zoom in» | en | `/appointments` | «zoom in» | Zoom at 110%. |
| «zoom» | en | `/appointments` | «zoom» | Zoom at 110%. |
| «bigger» | en | `/appointments` | «bigger» | Zoom at 110%. |
| «make it bigger» | en | `/appointments` | «make it bigger» | Zoom at 110%. |
| «enlarge» | en | `/appointments` | «enlarge» | Zoom at 110%. |
| «closer» | en | `/appointments` | «closer» | Zoom at 110%. |
| «increase the zoom» | en | `/appointments` | «increase the zoom» | Zoom at 110%. |
| «zoom out» | en | `/appointments` | «zoom out» | Zoom at 90%. |
| «smaller» | en | `/appointments` | «smaller» | Zoom at 90%. |
| «make it smaller» | en | `/appointments` | «make it smaller» | Zoom at 90%. |
| «shrink it» | en | `/appointments` | «shrink it» | Zoom at 90%. |
| «decrease the zoom» | en | `/appointments` | «decrease the zoom» | Zoom at 90%. |
| «max zoom» | en | `/appointments` | «max zoom» | Zoom at 250%. |
| «zoom all the way in» | en | `/appointments` | «zoom all the way in» | Zoom at 250%. |
| «as big as possible» | en | `/appointments` | «as big as possible» | Zoom at 250%. |
| «maximum zoom» | en | `/appointments` | «maximum zoom» | Zoom at 250%. |
| «min zoom» | en | `/appointments` | «min zoom» | Zoom at 30%. |
| «zoom all the way out» | en | `/appointments` | «zoom all the way out» | Zoom at 30%. |
| «as small as possible» | en | `/appointments` | «as small as possible» | Zoom at 30%. |
| «minimum zoom» | en | `/appointments` | «minimum zoom» | Zoom at 30%. |
| «zoom to 80» | en | `/appointments` | «zoom to 80» | Zoom at 80%. |
| «zoom 120 percent» | en | `/appointments` | «zoom 120 percent» | Zoom at 120%. |
| «zoom to 200 percent» | en | `/appointments` | «zoom to 200 percent» | Zoom at 200%. |
| «reset zoom» | en | `/appointments` | «reset zoom» | Zoom at 100%. |
| «normal zoom» | en | `/appointments` | «normal zoom» | Zoom at 100%. |
| «zoom back to normal» | en | `/appointments` | «zoom back to normal» | Zoom at 100%. |
| «zoom in a lot» | en | `/appointments` | «zoom in a lot» | Zoom at 130%. |
| «zoom out a lot» | en | `/appointments` | «zoom out a lot» | Zoom at 70%. |

## V-EN-PANEL

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «open the calendars panel» | en | `/appointments` | «open the calendars panel» | **Calendars panel** · Done, I opened the calendars panel. |
| «show the sidebar» | en | `/appointments` | «show the sidebar» | **Calendars panel** · Done, I opened the calendars panel. |
| «open the side panel» | en | `/appointments` | «open the side panel» | **Calendars panel** · Done, I opened the calendars panel. |
| «pin the panel» | en | `/appointments` | «pin the panel» | **Calendars panel** · Done, the calendars panel stays pinned. |
| «keep the panel open» | en | `/appointments` | «keep the panel open» | **Calendars panel** · Done, the calendars panel stays pinned. |
| «pin the sidebar» | en | `/appointments` | «pin the sidebar» | **Calendars panel** · Done, the calendars panel stays pinned. |

## V-EN-PANEL · close and unpin

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «close the panel» | en | `/appointments` | «pin the panel» | **Calendars panel** · Done, the calendars panel stays pinned. |
| 〃 | en | `/appointments` | «close the panel» | **Close** · Done, I closed: the calendars panel. |
| «hide the sidebar» | en | `/appointments` | «pin the panel» | **Calendars panel** · Done, the calendars panel stays pinned. |
| 〃 | en | `/appointments` | «hide the sidebar» | **Close** · Done, I closed: the calendars panel. |
| «unpin the panel» | en | `/appointments` | «pin the panel» | **Calendars panel** · Done, the calendars panel stays pinned. |
| 〃 | en | `/appointments` | «unpin the panel» | **Calendars panel** · Done, the calendars panel hides itself after picking a calendar. |
| «let the sidebar auto hide» | en | `/appointments` | «pin the panel» | **Calendars panel** · Done, the calendars panel stays pinned. |
| 〃 | en | `/appointments` | «let the sidebar auto hide» | **Calendars panel** · Done, the calendars panel hides itself after picking a calendar. |

## V-EN-CALENDAR

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «only calendar Ortodoncia» | en | `/appointments` | «only calendar Ortodoncia» | **Calendar filters** · Done, only Ortodoncia. |
| «show calendar Ortodoncia» | en | `/appointments` | «show calendar Ortodoncia» | **Calendar filters** · Done, only Ortodoncia. |
| «switch to Sillón 2» | en | `/appointments` | «switch to Sillón 2» | **Calendar filters** · Done, only Sillón 2. |
| «go to chair 2» | en | `/appointments` | «go to chair 2» | **Calendar filters** · Done, only Sillón 2. |
| «open calendar Sillón 1» | en | `/appointments` | «open calendar Sillón 1» | **Calendar filters** · Done, only Sillón 1. |

## V-EN-STATUS · arrived

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Juan Pérez arrived» | en | `/appointments` | «Juan Pérez arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |
| «Juan Pérez is here» | en | `/appointments` | «Juan Pérez is here» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |
| «Juan Pérez just arrived» | en | `/appointments` | «Juan Pérez just arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |
| «check in Juan Pérez» | en | `/appointments` | «check in Juan Pérez» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |
| «mark Juan Pérez as arrived» | en | `/appointments` | «mark Juan Pérez as arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |
| «Juan Pérez is in the waiting room» | en | `/appointments` | «Juan Pérez is in the waiting room» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |
| «the 10 o clock arrived» | en | `/appointments` | «the 10 o clock arrived» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived. |

## V-EN-STATUS · confirmed

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Carlos López confirmed» | en | `/appointments` | «Carlos López confirmed» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Confirmed. |
| «confirm Carlos López» | en | `/appointments` | «confirm Carlos López» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Confirmed. |
| «confirm Carlos López's appointment» | en | `/appointments` | «confirm Carlos López's appointment» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Confirmed. |
| «mark Carlos López as confirmed» | en | `/appointments` | «mark Carlos López as confirmed» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now Confirmed. |

## V-EN-STATUS · no show

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Carlos López is a no show» | en | `/appointments` | «Carlos López is a no show» | **Appointment status** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now No-show. |
| «Carlos López didn't show up» | en | `/appointments` | «Carlos López didn't show up» | **Appointment status** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now No-show. |
| «Carlos López did not come» | en | `/appointments` | «Carlos López did not come» | **Appointment status** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now No-show. |
| «mark Carlos López as no show» | en | `/appointments` | «mark Carlos López as no show» | **Appointment status** · Careful: check it is the right appointment. “Yes” changes it, “no” leaves it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Carlos López’s appointment is now No-show. |

## V-EN-STATUS · in progress / completed / late

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «Juan Pérez is in progress» | en | `/appointments` | «Juan Pérez is in progress» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now In progress. |
| «start Juan Pérez» | en | `/appointments` | «start Juan Pérez» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now In progress. |
| «start Juan Pérez's appointment» | en | `/appointments` | «start Juan Pérez's appointment» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now In progress. |
| «Juan Pérez is done» | en | `/appointments` | «Juan Pérez is done» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Completed. |
| «Juan Pérez finished» | en | `/appointments` | «Juan Pérez finished» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Completed. |
| «complete Juan Pérez's appointment» | en | `/appointments` | «complete Juan Pérez's appointment» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Completed. |
| «mark Juan Pérez as completed» | en | `/appointments` | «mark Juan Pérez as completed» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Completed. |
| «Juan Pérez arrived late» | en | `/appointments` | «Juan Pérez arrived late» | **Appointment status** · Say “yes” to change it or “no” to leave it as it is. |
| 〃 | en | `/appointments` | «yes» | **Appointment status** · Done, Juan Pérez’s appointment is now Arrived late. |

## V-EN-INFO · visits

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «how many times has Juan Pérez come» | en | `/appointments` | «how many times has Juan Pérez come» | Patient information |
| «how many visits does Juan Pérez have» | en | `/appointments` | «how many visits does Juan Pérez have» | Patient information |
| «how many times did Juan Pérez visit» | en | `/appointments` | «how many times did Juan Pérez visit» | Patient information |
| «how often has Juan Pérez come» | en | `/appointments` | «how often has Juan Pérez come» | Patient information |

## V-EN-INFO · no-shows

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «how many no shows does Juan Pérez have» | en | `/appointments` | «how many no shows does Juan Pérez have» | Patient information |
| «how many times has Juan Pérez missed» | en | `/appointments` | «how many times has Juan Pérez missed» | Patient information |
| «how many times didn't Juan Pérez show up» | en | `/appointments` | «how many times didn't Juan Pérez show up» | Patient information |
| «when was Juan Pérez's last no show» | en | `/appointments` | «when was Juan Pérez's last no show» | Patient information |

## V-EN-INFO · cancellations

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «how many cancellations does Juan Pérez have» | en | `/appointments` | «how many cancellations does Juan Pérez have» | Patient information |
| «how many times has Juan Pérez cancelled» | en | `/appointments` | «how many times has Juan Pérez cancelled» | Patient information |

## V-EN-INFO · money

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «how much does Juan Pérez owe» | en | `/appointments` | «how much does Juan Pérez owe» | Patient information |
| «does Juan Pérez owe anything» | en | `/appointments` | «does Juan Pérez owe anything» | Patient information |
| «what's Juan Pérez's balance» | en | `/appointments` | «what's Juan Pérez's balance» | Patient information |
| «is Juan Pérez up to date with payments» | en | `/appointments` | «is Juan Pérez up to date with payments» | Patient information |
| «what was Juan Pérez's last payment» | en | `/appointments` | «what was Juan Pérez's last payment» | Patient information |
| «when did Juan Pérez last pay» | en | `/appointments` | «when did Juan Pérez last pay» | Patient information |
| «how much has Juan Pérez paid» | en | `/appointments` | «how much has Juan Pérez paid» | Patient information |

## V-EN-INFO · quotes, invoices, treatments

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «what quotes does Juan Pérez have» | en | `/appointments` | «what quotes does Juan Pérez have» | Patient information |
| «what's the status of Juan Pérez's quotes» | en | `/appointments` | «what's the status of Juan Pérez's quotes» | Patient information |
| «what invoices does Juan Pérez have» | en | `/appointments` | «what invoices does Juan Pérez have» | Patient information |
| «how many invoices does Juan Pérez have» | en | `/appointments` | «how many invoices does Juan Pérez have» | Patient information |
| «what treatments does Juan Pérez have in progress» | en | `/appointments` | «what treatments does Juan Pérez have in progress» | Patient information |
| «how is Juan Pérez's treatment going» | en | `/appointments` | «how is Juan Pérez's treatment going» | Patient information |

## V-EN-INFO · summary

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «summarize Juan Pérez» | en | `/appointments` | «summarize Juan Pérez» | Patient information |
| «give me a summary of Juan Pérez» | en | `/appointments` | «give me a summary of Juan Pérez» | Patient information |
| «stats for Juan Pérez» | en | `/appointments` | «stats for Juan Pérez» | Patient information |
| «what do we know about Juan Pérez» | en | `/appointments` | «what do we know about Juan Pérez» | Patient information |
| «tell me about Juan Pérez» | en | `/appointments` | «tell me about Juan Pérez» | Patient information |

## V-EN-ACTION

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «create a quote for Juan Pérez» | en | `/appointments` | «create a quote for Juan Pérez» | **New quote** · Done, I opened a new quote for Juan Pérez. |
| «make a quote for Juan Pérez» | en | `/appointments` | «make a quote for Juan Pérez» | **New quote** · Done, I opened a new quote for Juan Pérez. |
| «new quote for Juan Pérez» | en | `/appointments` | «new quote for Juan Pérez» | **New quote** · Done, I opened a new quote for Juan Pérez. |
| «new estimate for Juan Pérez» | en | `/appointments` | «new estimate for Juan Pérez» | **New quote** · Done, I opened a new quote for Juan Pérez. |
| «create an invoice for Juan Pérez» | en | `/appointments` | «create an invoice for Juan Pérez» | **New invoice** · Done, I opened a new invoice for Juan Pérez. |
| «new invoice for Juan Pérez» | en | `/appointments` | «new invoice for Juan Pérez» | **New invoice** · Done, I opened a new invoice for Juan Pérez. |
| «invoice Juan Pérez» | en | `/appointments` | «invoice Juan Pérez» | **New invoice** · Done, I opened a new invoice for Juan Pérez. |
| «create a treatment for Juan Pérez» | en | `/appointments` | «create a treatment for Juan Pérez» | **New treatment** · Done, I opened a new treatment for Juan Pérez. |
| «new treatment for Juan Pérez» | en | `/appointments` | «new treatment for Juan Pérez» | **New treatment** · Done, I opened a new treatment for Juan Pérez. |
| «add a treatment for Juan Pérez» | en | `/appointments` | «add a treatment for Juan Pérez» | **New treatment** · Done, I opened a new treatment for Juan Pérez. |
| «quick charge for Juan Pérez» | en | `/appointments` | «quick charge for Juan Pérez» | **Quick charge** · Done, I opened Juan Pérez's quick charge. |
| «charge Juan Pérez» | en | `/appointments` | «charge Juan Pérez» | **Quick charge** · Done, I opened Juan Pérez's quick charge. |
| «quick bill Juan Pérez» | en | `/appointments` | «quick bill Juan Pérez» | **Quick charge** · Done, I opened Juan Pérez's quick charge. |
| «record Juan Pérez's clinical session» | en | `/appointments` | «record Juan Pérez's clinical session» | **Clinical session** · Done, I opened Juan Pérez's clinical session. |
| «new session for Juan Pérez» | en | `/appointments` | «new session for Juan Pérez» | **Clinical session** · Done, I opened Juan Pérez's clinical session. |
| «start Juan Pérez's clinical session» | en | `/appointments` | «start Juan Pérez's clinical session» | **Clinical session** · Done, I opened Juan Pérez's clinical session. |

## V-EN-SETTINGS

| Prueba | Idioma | Pantalla | Se dijo | Respondió |
| --- | --- | --- | --- | --- |
| «15 minute slots» | en | `/appointments` | «15 minute slots» | **Calendar settings** · Done: 15-minute slots. |
| «slots of 10 minutes» | en | `/appointments` | «slots of 10 minutes» | **Calendar settings** · Done: 10-minute slots. |
| «half hour slots» | en | `/appointments` | «half hour slots» | **Calendar settings** · Done: 30-minute slots. |
| «one hour slots» | en | `/appointments` | «one hour slots» | **Calendar settings** · Done: 60-minute slots. |
| «default view day» | en | `/appointments` | «default view day» | **Calendar settings** · Done: default view day. |
| «start in week view by default» | en | `/appointments` | «start in week view by default» | **Calendar settings** · Done: default view week. |
| «make month the default view» | en | `/appointments` | «make month the default view» | **Calendar settings** · Done: default view month. |
| «hide sundays» | en | `/appointments` | «hide sundays» | **Calendar settings** · Done: hidden: Sunday. |
| «don't show saturdays» | en | `/appointments` | «don't show saturdays» | **Calendar settings** · Done: hidden: Saturday. |
| «hide the weekend» | en | `/appointments` | «hide the weekend» | **Calendar settings** · Done: hidden: Saturday, Sunday. |
| «only show clinic hours» | en | `/appointments` | «only show clinic hours» | **Calendar settings** · Done: clinic hours visible. |
| «show the full day» | en | `/appointments` | «show the full day» | **Calendar settings** · Done: full day visible. |
| «visible hours from 9 to 6» | en | `/appointments` | «visible hours from 9 to 6» | **Calendar settings** · Done: visible hours 09:00 to 18:00. |
| «hour height 140» | en | `/appointments` | «hour height 140» | **Calendar settings** · Done: hour height 140 px. |
| «shorter hours» | en | `/appointments` | «shorter hours» | **Calendar settings** · Done: hour height 60 px. |
| «custom mode» | en | `/appointments` | «custom mode» | **Calendar settings** · Done: custom mode. |
| «invoke mode» | en | `/appointments` | «invoke mode» | **Calendar settings** · Done: Invoke mode. |
| «turn on color by status» | en | `/appointments` | «turn on color by status» | **Calendar settings** · Done: color by status on. |
| «turn off color by status» | en | `/appointments` | «turn off color by status» | **Calendar settings** · Done: color by status off. |

