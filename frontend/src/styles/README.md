# Relay Styles

This folder contains style definitions used across the Relay dashboard:

- `globals.scss` - Implements a [CSS Reset][], adds some top-level styles.
- `colors.scss` - Implements the colors for the [Nebula Design System][],
  overriding the [Mozilla Protocol colors][].
- `text.scss` - Implements typography mixins that extend [Mozilla Protocol typography][] to take a [content block][] to avoid [mixed declarations][].

[CSS Reset]: https://en.wikipedia.org/wiki/Reset_style_sheet
[Mozilla Protocol colors]: https://protocol.mozilla.org/docs/fundamentals/color
[Mozilla Protocol typography]: https://protocol.mozilla.org/docs/fundamentals/typography
[Nebula Design System]: https://www.peterbenvenuto.com/nebula
[content block]: https://sass-lang.com/documentation/at-rules/mixin/#content-blocks
[mixed declarations]: https://sass-lang.com/documentation/breaking-changes/mixed-decls/

## Colors

The [Nebula Design System][] was launched in 2023 to implement a shared style across the Privacy and Security products ([Mozilla VPN][], [Mozilla Monitor][], and Firefox Relay). It defines a consistent typography and color scheme for applications, web pages, and marketing materials.

The system is implemented by defining the colors in `colors.scss`, and adjusting other styles as needed. These colors are used with this pattern:

```scss
@use "~@mozilla-protocol/core/protocol/css/includes/lib" as *;
@use "../styles/color";

.warning {
  background-color: color.$white;
  border-color: color.$yellow-50;
}
```

When using the [Mozilla Protocol colors][], the pattern is:

```scss
@use "~@mozilla-protocol/core/protocol/css/includes/lib" as *;
@use "../styles/color";

.warning {
  background-color: $color-white;
  border-color: $color-yellow-50;
}
```

[Mozilla VPN]: https://www.mozilla.org/en-US/products/vpn/
[Mozilla Monitor]: https://monitor.mozilla.org/

## Text

[Mozilla Protocol typography][] defines [@mixins][] that are used to apply standard text styles to elements, as well as vary them for desktop-sized displays. For example, here is [text-title-xs][], for extra-small titles:

```scss
@mixin text-title-xs {
  @include font-size(type-scale("title-2xs-size"));
  line-height: type-scale("title-2xs-line-height");

  @media #{$mq-md} {
    @include font-size(type-scale("title-xs-size"));
    line-height: type-scale("title-xs-line-height");
  }
}
```

This is used with an `@include` statement, like:

```scss
@use "~@mozilla-protocol/core/protocol/css/includes/lib" as *;

.headline {
  @include text-title-xs;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $spacing-sm 0;
  gap: $spacing-sm;
  font-weight: 100;
}
```

This is complied to CSS such as:

```css
.EmailForwardingModal_headline__VgCSC {
  font-size: 24px;
  font-size: 1.5rem;
  line-height: 1.08;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  gap: 8px;
  font-weight: 100;
}
@media (min-width: 768px) {
  .EmailForwardingModal_headline__VgCSC {
    font-size: 28px;
    font-size: 1.75rem;
    line-height: 1.07;
  }
}
```

Dart Sass 1.77.7 deprecated [mixing declarations with nested rules][]. This
will allow Sass to adopt CSS rules for declaration order. After the change, this
would instead be compiled to:

```css
.EmailForwardingModal_headline__VgCSC {
  font-size: 24px;
  font-size: 1.5rem;
  line-height: 1.08;
}
@media (min-width: 768px) {
  .EmailForwardingModal_headline__VgCSC {
    font-size: 28px;
    font-size: 1.75rem;
    line-height: 1.07;
  }
}
.EmailForwardingModal_headline__VgCSC {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  gap: 8px;
  font-weight: 100;
}
```

Due to the change in [property order][], this may change the type display. For example,
`font-weight: 100` may no longer apply at desktop resolutions. The problem is tracked in [mozilla/protocol issue #998][].

Relay's local solution is in `text.scss`. It re-implements the `@mixin`s
to take a [content block][]:

```scss
@mixin title-xs {
  @include font-size(type-scale("title-2xs-size"));
  line-height: type-scale("title-2xs-line-height");
  @content;

  @media #{$mq-md} {
    @include font-size(type-scale("title-xs-size"));
    line-height: type-scale("title-xs-line-height");
  }
}
```

This is used in a similar way to generate the same CSS as before:

```scss
@use "~@mozilla-protocol/core/protocol/css/includes/lib" as *;
@use "../../styles/text" .headline {
  @include text.title-xs {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-sm 0;
    gap: $spacing-sm;
    font-weight: 100;
  }
}
```

This also means that `text.scss` is tied to a specific version of `@mozilla-protocol`,
and must be updated when that package is updated. The work for the next update,
to [v18.0.0][], is tracked in [MPP-3946][].

[@mixins]: https://sass-lang.com/documentation/at-rules/mixin/
[MPP-3946]: https://mozilla-hub.atlassian.net/browse/MPP-3946
[mixing declarations with nested rules]: https://sass-lang.com/documentation/breaking-changes/mixed-decls/
[mozilla/protocol issue #998]: https://github.com/mozilla/protocol/issues/998
[property order]: https://stackoverflow.com/questions/13080220/how-important-is-css-property-order
[text-title-xs]: https://github.com/mozilla/protocol/blob/f318aafa0f3b5ff8815c4b859d5a2de9146657f4/assets/sass/protocol/includes/mixins/_typography.scss#L100-L108
[v18.0.0]: https://github.com/mozilla/protocol/releases/tag/v18.0.0
