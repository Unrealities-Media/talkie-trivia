# Android tab mount investigation

Findings 05/26 remain open. This records a targeted mitigation and the limits of
its evidence, not a general navigation stability approval.

## Observed failure

The API 36 x86_64/16 KB release emulator showed a persistent blank screen after
ordinary process restart, Game to Profile navigation and a scroll gesture. Native
logs recorded a missing Fabric view tag 36, then insertion of tag 40 into parent
44 at index 1 with zero existing children. React Native destroyed its host/runtime;
there was no JavaScript error boundary to display. A further process restart
recovered Game, Profile and the saved reminder-off preference.

Original evidence is under `.expo/device-proof/r30-clock-change/`:
`blank-screen-logcat.txt`, `fixed-off-settings.png`, `fixed-off-settled.xml` and
the recovery captures. The APK SHA-256 was
`79f33b70122ff5d4a6c5a070b4fcfd3a35f7e1f81f7e37b2d290df2c2a6530cd`.

## Identified native subtree

The subsequent healthy activity hierarchy identifies parent 44 (`#2c`) as Game's
hidden tab icon container, tag 36 (`#24`) as its active icon wrapper, and tag 40
(`#28`) as its inactive placeholder text. These are outside Profile's content.
The app used `tabBarIconStyle: { display: "none" }` without supplying an icon
renderer. The installed navigation library still created two default placeholder
icons and changed their wrapper opacity during focus transitions. Its source
`node_modules/expo-router/build/react-navigation/bottom-tabs/views/TabBarIcon.js`
and the native hierarchy agree on this subtree.

An initial mitigation supplied an icon renderer returning null and a zero-size
icon container. The third native restart/navigation attempt still logged a missing
view (tag 32), although Profile remained visible. The navigation library retained
the active/inactive icon wrappers. That artifact is preserved as
`r30-tabs-final/talkie-demo-emulator-only.apk`, SHA-256
`9259e543cc10277071d9127fd8e7493a07c553ef211eb0fbcf28239487bda6da`;
it is a failed mitigation, not the accepted final implementation.

The layout now supplies `TextTabBar`, which renders just the two launch tab buttons
and labels. It contains no hidden/default icon subtree or focus-opacity wrappers.
Cancellable press events, selected-tab reselection, long presses and route
parameters continue through Expo Router's navigator. Selected tab semantics,
font fallback/scaling, horizontal/bottom insets and minimum 48-point targets are
explicit. The bar grows with its text rather than clipping it to a fixed height.
This does not prove the underlying Fabric mechanism or exclude other affected
native subtrees; the native renderer is unchanged and errors are not suppressed.

## Verification and remaining work

Before the change, six process-restart/navigation/swipe attempts and 60 alternating
Game/Profile transitions did not reproduce the captured failure. Preserve this
negative result: an equally passing run after the change cannot alone prove a fix.
Local evidence is under `.expo/device-proof/profile-mount/`, including each
process's log, UI tree, and `healthy-activity.txt` with the tag mapping above.

Fifteen initial tab/font-fallback/readability component tests passed. After
replacing the bar, seven targeted layout and navigation-event tests pass, including
prevented presses, reselection/long press, parameter preservation and selected-tab
accessibility. App TypeScript passes with props derived from the actual Expo Router
Tabs API (its bundled navigator types differ from the separate navigation package).
These tests mock the native bridge and are not Fabric regression tests.
The final installed APK passes six ordinary process-death/restart/Profile/swipe
checks and 60 alternating Game/Profile transitions without `MissingViewState` or
`addViewAt` errors, with the Profile UI still present. The native activity hierarchy
now has two tab buttons, each with one label and no icon descendants. At normal and
200% system text size, both labels fit inside their buttons; targets measure about
176 by 59 dp. The larger font was observed in the native text bounds and screenshot,
and the original font setting was restored. These are light-theme emulator checks,
not screen-reader or complete accessibility acceptance.

Final artifact: `.expo/device-proof/r30-text-tabs-final/talkie-demo-emulator-only.apk`,
SHA-256 `fa3a5e99320acdf0bed70a23cee7834eba60fd198af59a966ce70e7cebf098b2`.
The build completed in 46 seconds; v2/v3 signatures and 16 KB ZIP alignment pass.
All 56 native shared libraries are byte-identical to the prior reminder artifact;
the 19 RELRO failures remain. Final evidence uses `text-tabs-*` files in the
`profile-mount` directory. No backend was started or account action performed.

The captured faulty subtree is removed and bounded regression checks pass. The
underlying renderer race remains unproven, and passing the same baseline checks
without a failure means this is not exhaustive proof of stability. Physical Android,
other ABIs/OS versions, iOS and longer navigation/fault testing remain required.
