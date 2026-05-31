# Hero Banner Rebuild Prompt for DeepSeek

## Problem Statement

The hero banner on the Level Up homepage is broken across all breakpoints:
- **Desktop:** Forced into 2-column grid layout (should be single column)
- **Tablet/Mobile:** Content cut off on right side, text truncated
- **All sizes:** Button visibility inconsistent, wrong height calculation blocking ticker

## Solution Approach

We're rebuilding the hero CSS from scratch, fixing:
1. Single-column layout on ALL breakpoints
2. Correct hero height calculation
3. Responsive typography using `clamp()`
4. Proper button styling and visibility
5. Consistent spacing across devices

---

## Current HTML Structure (Fixed — Do NOT Change)

```html
<div class="elementor-element-c89219b e-con-full e-flex e-con e-parent">
  <div class="e-con-inner">
    <!-- Left column: intro + title -->
    <div class="elementor-element-9b1e9a1 home-caption e-flex e-con-boxed">
      
      <!-- Intro text -->
      <div class="elementor-element-5d634f6 home-subtitle">
        <p>We are a feminist community campaigning for gender justice in the UK.</p>
        <p>Take action on our latest campaign:</p>
      </div>
      
      <!-- Campaign title -->
      <div class="elementor-element-735cde0">
        <h2>#NO MORE LYES</h2>
      </div>
      
      <!-- Right column: button + description -->
      <div class="elementor-element-5198fdb e-con-full e-flex">
        
        <!-- Button: Sign petition -->
        <div class="elementor-element-6ce9a68">
          <a class="elementor-button" href="...">Sign the petition</a>
        </div>
        
        <!-- Button 2: Research (hidden on mobile via elementor-hidden-mobile) -->
        <div class="elementor-element-5416038 elementor-hidden-mobile">
          <a class="elementor-button" href="...">Explore Research</a>
        </div>
        
        <!-- Description -->
        <div class="elementor-element-c703ee4">
          <p>Big beauty brands like L'Oréal must remove toxic ingredients...</p>
          <p>The price of Black women's beauty should never be our health.</p>
        </div>
      </div>
      
    </div>
  </div>
</div>

<!-- Ticker below -->
<div class="ic-bar">Yellow carousel</div>
```

---

## Design Specifications

### Layout Structure
- **Hero container:** Full width, single column
- **Content arrangement:** All items stacked vertically
- **Background:** Gradient + image (inherited from HTML)
- **Overflow:** Hidden (no scroll within hero)

### Viewport Specifications

#### Desktop (1025px and above)
| Property | Value |
|----------|-------|
| Height | `100vh - 107px` (nav 70px + ticker 37px) |
| Layout | Flex column, single stack |
| Padding | `80px 48px 48px` |
| Intro text | 15px, line-height 1.4 |
| Title (#NO MORE LYES) | 48px bold, line-height 1.1 |
| Button | Lime (#CCFF33) bg, navy (#0C0A3E) text, 15px font |
| Description | 14px, line-height 1.35 |

#### Tablet (768px–1024px)
| Property | Value |
|----------|-------|
| Height | `100vh - 70px` (nav only) |
| Layout | Flex column, single stack |
| Padding | `24px 20px 20px` |
| Intro text | `clamp(13px, 2vw, 15px)` |
| Title | `clamp(28px, 6vw, 42px)` |
| Button | Same styling as desktop |
| Description | `clamp(13px, 1.5vw, 14px)` |

#### Mobile (<768px)
| Property | Value |
|----------|-------|
| Height | `100vh - 70px` (nav only) |
| Layout | Flex column, single stack |
| Padding | `16px 16px 12px` |
| Intro text | `clamp(12px, 1.5vw, 13px)` |
| Title | `clamp(20px, 4vw, 28px)` |
| Button | Same styling, smaller touch target if needed |
| Description text | **Hidden with `display: none`** |

---

## CSS to Write

### 1. Hero Container (Main)
```css
.elementor-element-c89219b {
  /* Height and layout */
  height: calc(100vh - 107px) !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  
  /* Spacing */
  padding: 80px 48px 48px !important;
  
  /* Ensure full width */
  width: 100% !important;
  max-width: 100% !important;
  box-sizing: border-box !important;
}
```

### 2. Inner Container (.e-con-inner)
```css
.elementor-element-c89219b .e-con-inner {
  /* Single column flex */
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  max-width: 100% !important;
  
  /* Content spacing */
  gap: 16px !important;
  padding: 0 !important;
  margin: 0 !important;
  
  /* Overflow handling */
  overflow: hidden !important;
}
```

### 3. Home Caption (Left Column Container)
```css
.elementor-element-9b1e9a1.home-caption {
  /* Single column stack */
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  max-width: 100% !important;
  
  /* Content spacing */
  gap: 12px !important;
  padding: 0 !important;
  margin: 0 !important;
  
  /* Flex behavior */
  flex: 0 0 auto !important;
}
```

### 4. Intro Text (.home-subtitle)
```css
.elementor-element-c89219b .elementor-element-5d634f6.home-subtitle p {
  font-size: 15px !important;
  line-height: 1.4 !important;
  margin: 0 0 4px 0 !important;
  color: inherit !important;
}
```

### 5. Title (h2)
```css
.elementor-element-c89219b .elementor-heading-title {
  font-size: 48px !important;
  font-weight: 700 !important;
  line-height: 1.1 !important;
  margin: 8px 0 16px 0 !important;
  overflow: visible !important;
  word-break: break-word !important;
  max-width: 100% !important;
}
```

### 6. Button Container (5198fdb)
```css
.elementor-element-5198fdb {
  /* Single column flex */
  display: flex !important;
  flex-direction: column !important;
  width: 100% !important;
  max-width: 100% !important;
  
  /* Content spacing */
  gap: 16px !important;
  padding: 0 !important;
  margin: 0 !important;
  
  /* Flex behavior */
  flex: 0 0 auto !important;
}
```

### 7. Button Styling
```css
.elementor-element-c89219b .elementor-button {
  /* Colors */
  background: #CCFF33 !important;
  color: #0C0A3E !important;
  
  /* Sizing */
  font-size: 15px !important;
  padding: 12px 28px !important;
  min-height: 44px !important;
  border-radius: 6px !important;
  
  /* Typography */
  font-weight: 700 !important;
  line-height: 1.2 !important;
  text-decoration: none !important;
  
  /* Display */
  display: inline-block !important;
  border: none !important;
  cursor: pointer !important;
}

.elementor-element-c89219b .elementor-button-wrapper {
  display: inline-block !important;
}
```

### 8. Description Text
```css
.elementor-element-c89219b .elementor-element-c703ee4 p {
  font-size: 14px !important;
  line-height: 1.35 !important;
  margin: 0 !important;
  color: inherit !important;
}
```

### 9. Tablet Breakpoint (768px–1024px)
```css
@media (max-width: 1024px) {
  .elementor-element-c89219b {
    height: calc(100vh - 70px) !important;
    padding: 24px 20px 20px !important;
  }
  
  .elementor-element-c89219b .e-con-inner {
    gap: 8px !important;
  }
  
  .elementor-element-9b1e9a1.home-caption {
    gap: 8px !important;
  }
  
  .elementor-element-c89219b .elementor-element-5d634f6.home-subtitle p {
    font-size: clamp(13px, 2vw, 15px) !important;
    line-height: 1.35 !important;
    margin-bottom: 2px !important;
  }
  
  .elementor-element-c89219b .elementor-heading-title {
    font-size: clamp(28px, 6vw, 42px) !important;
    margin: 4px 0 12px 0 !important;
  }
  
  .elementor-element-c89219b .elementor-element-c703ee4 p {
    font-size: clamp(13px, 1.5vw, 14px) !important;
  }
}
```

### 10. Mobile Breakpoint (<768px)
```css
@media (max-width: 767px) {
  .elementor-element-c89219b {
    height: calc(100vh - 70px) !important;
    padding: 16px 16px 12px !important;
  }
  
  .elementor-element-c89219b .e-con-inner {
    gap: 6px !important;
  }
  
  .elementor-element-9b1e9a1.home-caption {
    gap: 6px !important;
  }
  
  .elementor-element-c89219b .elementor-element-5d634f6.home-subtitle p {
    font-size: clamp(12px, 1.5vw, 13px) !important;
    line-height: 1.3 !important;
    margin-bottom: 1px !important;
  }
  
  .elementor-element-c89219b .elementor-heading-title {
    font-size: clamp(20px, 4vw, 28px) !important;
    margin: 2px 0 8px 0 !important;
  }
  
  /* Hide long description on mobile */
  .elementor-element-c89219b .elementor-element-c703ee4 {
    display: none !important;
  }
  
  .elementor-element-c89219b .elementor-button {
    font-size: 13px !important;
    padding: 10px 20px !important;
    min-height: 40px !important;
  }
}
```

---

## Implementation Checklist

- [ ] Copy all CSS sections above into `src/pages/index.astro` inside `<style>` block
- [ ] Remove any existing conflicting CSS (especially the grid layout rule)
- [ ] Replace `.elementor-element-c89219b` default styles
- [ ] Test on **desktop (1440px)** — hero should fill viewport minus ticker
- [ ] Test on **tablet (768px)** — fonts should scale, single column maintained
- [ ] Test on **mobile (375px)** — intro + title + button visible, description hidden
- [ ] Verify ticker is visible below hero without scrolling on all sizes
- [ ] Verify button is visible and clickable with correct lime color on all sizes
- [ ] Verify no horizontal overflow on any breakpoint

---

## Files to Modify

**Single file:** `src/pages/index.astro`

Location: Find the `<style>` block around line 250–330, replace the hero CSS section with the CSS provided above.

---

## Success Criteria

✅ Single column layout on ALL breakpoints (desktop, tablet, mobile)
✅ Correct hero height: `calc(100vh - 107px)` desktop, `calc(100vh - 70px)` tablet/mobile
✅ Ticker visible without forced scroll
✅ Button visible with #CCFF33 background and #0C0A3E text
✅ Responsive fonts using `clamp()` for smooth scaling
✅ No text truncation or overflow on any device
✅ Description text hidden on mobile (<768px)
✅ Intro text + title + button all visible on small screens
