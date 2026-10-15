# Search preview accessibility

The search result previously offered preview only through a long press. Keyboard
users could focus the guessing action but had no discoverable preview control.

Each result now has a separate Preview movie button with a minimum 44-point
height, a movie/year accessible name, an expanded state and a no-guess hint.
It uses the existing local catalog preview and does not issue a game command.
The button is a sibling of the guess action, avoiding nested interactive controls.
Unavailable/already-guessed results retain their disabled behavior. Long press
still works. Preview copy explicitly says selecting the movie submits a guess.

The first real browser run caught a missing `aria-expanded` attribute despite
the native accessibility state being set. The web attribute is now explicit.
Focused unit coverage checks preview versus guess callbacks, disabled states and
the expanded label; browser contracts check search Enter focus, Tab to preview,
Enter to open, Space to close, preserved search text and an enabled guessing row.
The existing end-to-end flow then completes a game, reloads, shares and visits
history/profile at desktop and mobile viewport sizes.

Final verification: TypeScript and lint passed; 38 focused search tests passed,
with all 13 PickerItem tests passing again after the ARIA/copy correction; all
four Chromium browser contracts passed across 1440×900 and 390×844 viewports.
The browser runner exported a fresh web bundle and used isolated Firebase
emulators. Desktop preview layout was also inspected from the diagnostic capture.

This stage does not deploy the website, run native builds or establish physical
device/screen-reader acceptance. Public beta abuse controls, content approval,
live account lifecycle and the other release gates remain open.
