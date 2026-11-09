// Self-hosted web fonts -- replaces the Google Fonts <link> that used to sit in
// index.html (the privacy policy promises no third-party requests). Same
// families/axes/styles as that link requested:
//   Inter            opsz 14..32, wght 300-700, + italic   (variable, opsz build)
//   Lora             wght 400-700, + italic                 (variable)
//   Atkinson Hyperl. 400, 700, 400 italic
//   Merriweather     400, 700, 400 italic
// Each CSS file declares every unicode subset with unicode-range, so browsers
// only download the subsets a page actually uses -- same as Google's CSS.
import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/inter/opsz-italic.css'
import '@fontsource-variable/lora/wght.css'
import '@fontsource-variable/lora/wght-italic.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/atkinson-hyperlegible/400-italic.css'
import '@fontsource/merriweather/400.css'
import '@fontsource/merriweather/700.css'
import '@fontsource/merriweather/400-italic.css'
