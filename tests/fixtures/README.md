# Encrypted font fixture

`encrypted-source-han.otf` is a four-glyph subset of Adobe Source Han Sans CN Normal, obtained from https://github.com/adobe-fonts/source-han-sans/tree/release/SubsetOTF/CN (OFL, see OFL.txt).

The cmap has been deliberately scrambled: 精→奣, 神→奦, 文→奪, 化→奯. The source outlines are retained. Browser tests use the real font and OCS's official reference table to restore the original characters, including inside a question iframe before the answer API is invoked. This is a constructed regression fixture, not a capture from the user's course.

Generation script: `tools/generate-font-fixture.py`. To regenerate, place SourceHanSansCN-Normal.otf at `vendor/reference-font.otf` and its LICENSE.txt at `vendor/LICENSE-reference-font`, and install fonttools into `.tmp/fonttools` or the Python environment.
