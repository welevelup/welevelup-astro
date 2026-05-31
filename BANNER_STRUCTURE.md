# Hero Banner Structure Analysis

## Current HTML Structure

```
<div class="elementor-element-c89219b e-con-full e-flex e-con e-parent">
  <!-- MAIN HERO CONTAINER -->
  <!-- height: calc(100vh - 167px) -->
  <!-- background: linear gradient + image (from _clone/index.html) -->
  
  <div class="e-con-inner">
    <!-- WRAPPER for all children -->
    
    <!-- LEFT COLUMN: Intro Text + Title -->
    <div class="elementor-element-9b1e9a1 home-caption e-flex e-con-boxed">
      
      <!-- Intro paragraph -->
      <div class="elementor-element-5d634f6 home-subtitle">
        <p>We are a feminist community campaigning for gender justice in the UK.</p>
        <p>Take action on our latest campaign:</p>
      </div>
      
      <!-- Campaign Title -->
      <div class="elementor-element-735cde0">
        <h2>#NO MORE LYES</h2>
      </div>
      
      <!-- RIGHT COLUMN: Button + Description -->
      <div class="elementor-element-5198fdb e-con-full e-flex">
        
        <!-- Button 1: Sign petition -->
        <div class="elementor-element-6ce9a68">
          <a class="elementor-button" href="...">Sign the petition</a>
        </div>
        
        <!-- Button 2: Research submission (HIDDEN ON MOBILE) -->
        <div class="elementor-element-5416038 elementor-hidden-mobile">
          <a class="elementor-button" href="...">Explore Our Hair Relaxer Research Submission</a>
        </div>
        
        <!-- Description text -->
        <div class="elementor-element-c703ee4">
          <p>Big beauty brands like L'Oréal must remove toxic ingredients from hair relaxers.</p>
          <p>The price of Black women's beauty should never be our health.</p>
        </div>
        
      </div>
      
    </div>
  </div>
</div>

<!-- TICKER (carousel) below hero -->
<div class="ic-bar" style="height: 37px;">...</div>
```

---

## Key Measurements

| Element | Height | Notes |
|---------|--------|-------|
| Nav (.site-header) | ~70px | Contains logo + donate button + menu |
| Ticker (.ic-bar) | 37px | Yellow carousel below hero |
| **Hero target height** | `calc(100vh - 107px)` | 70 (nav) + 37 (ticker) = 107px |
| **Current hero height** | `calc(100vh - 167px)` | **WRONG — too tall, blocks ticker** |

---

## Current CSS Problems

### ❌ Desktop Layout (lines 273-282)
```css
@media (min-width: 1025px) {
  .elementor-element-c89219b {
    display: grid !important;
    grid-template-columns: 38% 1fr !important;  /* FORCES 2-COLUMN */
  }
}
```
**Problem:** Forces grid layout with 38% / 1fr split → breaks single-column hero design

### ❌ Hero Height
```css
.elementor-element-c89219b { 
  height: calc(100vh - 167px) !important;  /* TOO TALL */
}
```
**Problem:** 167px = nav (70) + unknown extra (97px) — blocks ticker view

---

## Design Intent (What Should Happen)

### Desktop (1025px+)
- Full viewport height minus nav/ticker
- **Single column layout** — text stacked vertically on left
- Left: intro text → title → button + description
- Button should be lime (#CCFF33) on navy text (#0C0A3E)
- Background image visible behind text

### Tablet (768px–1024px)
- Full viewport height minus nav
- **Single column layout** — same vertical stack
- Smaller fonts using `clamp()`
- Reduced padding

### Mobile (<768px)
- Full viewport height minus nav
- **Single column layout** — same vertical stack
- Intro text + title + button + description all stacked
- Very small fonts, minimal padding
- Text "The price of Black women's beauty..." should **disappear (display: none)**

---

## Elementor CSS Classes Reference

```css
.e-con-full       /* Full width container */
.e-flex           /* Flex display */
.e-con            /* Generic container */
.e-parent         /* Container is parent */
.e-child          /* Container is child */
.e-con-boxed      /* Boxed (has padding) */
.e-con-inner      /* Inner wrapper for flex children */
```

---

## Button Styling Requirements

```css
.elementor-element-c89219b .elementor-button {
  background: #CCFF33 !important;        /* Lime */
  color: #0C0A3E !important;             /* Navy text */
  border-radius: 6px !important;
  padding: 12px 28px !important;
  font-weight: 700 !important;
  font-size: 15px !important;
  min-height: 44px !important;
  display: inline-block !important;
}
```

---

## Next Steps for DeepSeek Rebuild

1. **Fix hero height:** Change from `calc(100vh - 167px)` to `calc(100vh - 107px)`
2. **Remove grid layout:** Delete the `@media (min-width: 1025px)` grid CSS block entirely
3. **Verify Elementor flex behavior:** `.e-flex` + `.e-con-inner` should naturally stack children vertically
4. **Test mobile/tablet:** Ensure `@media (max-width: 1024px)` properly reduces fonts and padding
5. **Verify button visibility:** Button should be visible on all breakpoints with correct colors
6. **Verify ticker visibility:** After fixing hero height, ticker should be visible without forced scroll

