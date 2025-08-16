# Assets Directory Structure

This directory contains all static assets for the Meshroom WebApp frontend.

## Directory Organization

```none
assets/
├── animations/          # Loading spinners, progress animations, transitions
├── backgrounds/         # Background images, patterns, textures
├── icons/              # Favicons, UI icons, toolbar icons
│   └── favicon.ico     # Site favicon
├── images/             # General images, illustrations, photos
└── logos/              # Brand logos, company logos, product logos
```

## Usage Guidelines

### Icons (`icons/`)

- **Purpose**: Small graphical elements for UI components and favicons
- **Formats**: `.ico`, `.svg`, `.png` (16x16, 24x24, 32x32, 48x48)
- **Examples**: favicon.ico, close-button.svg, menu-icon.png, apple-touch-icon.png
- **Naming**: Use kebab-case, descriptive names (`search-icon.svg`, `close-btn.png`)
- **Note**: Web manifests (`site.webmanifest`) belong in the web root, not here

### Images (`images/`)

- **Purpose**: General purpose images and illustrations
- **Formats**: `.jpg`, `.png`, `.webp`, `.svg`
- **Examples**: hero-image.jpg, placeholder.png, diagram.svg
- **Naming**: Use kebab-case, descriptive names

### Logos (`logos/`)

- **Purpose**: Brand and product logos
- **Formats**: `.svg` (preferred), `.png` (high-res)
- **Examples**: meshroom-logo.svg, alicevision-logo.png
- **Variants**: Include different sizes and color variants

### Backgrounds (`backgrounds/`)

- **Purpose**: Background images, patterns, textures
- **Formats**: `.jpg`, `.png`, `.webp`
- **Examples**: hero-bg.jpg, texture-pattern.png
- **Optimization**: Compress for web use

### Animations (`animations/`)

- **Purpose**: Animated graphics and loading indicators
- **Formats**: `.gif`, `.svg`, `.lottie`
- **Examples**: loading-spinner.svg, progress-animation.gif
- **Performance**: Keep file sizes small

## File Naming Conventions

1. **Use kebab-case**: `my-image-name.jpg`
2. **Be descriptive**: `upload-success-icon.svg` instead of `icon1.svg`
3. **Include size if relevant**: `logo-large.png`, `avatar-small.jpg`
4. **Include variant if applicable**: `button-primary.svg`, `button-secondary.svg`

## Optimization Guidelines

- **Images**: Compress for web, use appropriate formats (WebP for photos, SVG for graphics)
- **Icons**: Prefer SVG for scalability, use PNG for complex icons
- **Size limits**: Keep individual files under 1MB, optimize for loading speed
- **Responsive**: Provide different sizes for responsive design needs

## Adding New Assets

When adding new graphics files:

1. Choose the appropriate subdirectory based on purpose
2. Follow naming conventions
3. Optimize for web delivery
4. Update this README if adding new categories
5. Reference assets using relative paths: `assets/icons/filename.ext`

## Integration

Reference assets in HTML/CSS using the relative path from the web root:

```html
<!-- Icons -->
<link rel="icon" href="assets/icons/favicon.ico">
<img src="assets/icons/menu-icon.svg" alt="Menu">

<!-- Images -->
<img src="assets/images/hero-image.jpg" alt="Hero">

<!-- CSS Background -->
background-image: url('assets/backgrounds/texture.png');
```
