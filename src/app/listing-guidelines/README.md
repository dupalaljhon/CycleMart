# Listing Community Guidelines Component

## 📋 Overview
A beautifully styled, accordion-based community guidelines component for CycleMart's listing system. Displays 10 comprehensive rules for creating marketplace listings with an elegant dark theme interface.

## ✨ Features
- ✅ 10 comprehensive listing rules
- ✅ Accordion-style expandable/collapsible sections
- ✅ Dark theme with gradient styling
- ✅ Expand All / Collapse All functionality
- ✅ Smooth animations and transitions
- ✅ Fully responsive design
- ✅ Accessibility-friendly
- ✅ Print-friendly styles

## 🎨 Rules Included

1. **Only Bicycle-Related Items** - Ensures only cycling-related products are listed
2. **Provide Accurate Descriptions** - Requires honest, detailed product information
3. **Use Clear, Original Photos** - Mandates authentic, high-quality images
4. **Set Fair & Realistic Prices** - Prevents price manipulation
5. **No Prohibited or Illegal Items** - Blocks stolen/counterfeit goods
6. **Respond to Inquiries Promptly** - Encourages timely communication
7. **Complete Transactions Safely** - Promotes secure payment practices
8. **No Spam or Duplicate Listings** - Prevents listing abuse
9. **Respect Location Restrictions** - Enforces Olongapo City service area
10. **Update Listing Status** - Requires keeping listings current

## 🚀 Usage

### Option 1: Standalone Page (Recommended)
Navigate to the guidelines page:
```typescript
// In any component
import { Router } from '@angular/router';

constructor(private router: Router) {}

viewGuidelines() {
  this.router.navigate(['/listing-guidelines']);
}
```

URL: `http://localhost:4200/#/listing-guidelines`

### Option 2: Embed in Listing Modal
Add guidelines section to your listing modal:

**In listing-modal.component.ts:**
```typescript
import { ListingGuidelinesComponent } from '../listing-guidelines/listing-guidelines.component';

@Component({
  imports: [CommonModule, FormsModule, ListingGuidelinesComponent],
  // ...
})
export class ListingModalComponent {
  showGuidelines = false;
  
  toggleGuidelines() {
    this.showGuidelines = !this.showGuidelines;
  }
}
```

**In listing-modal.component.html:**
```html
<!-- Add button near modal header -->
<button (click)="toggleGuidelines()" 
        class="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
  View Listing Guidelines
</button>

<!-- Add guidelines section -->
<div *ngIf="showGuidelines" class="mt-4">
  <app-listing-guidelines></app-listing-guidelines>
</div>
```

### Option 3: Modal Popup
Create a separate modal to show guidelines:

**In your component:**
```typescript
showGuidelinesModal = false;

openGuidelines() {
  this.showGuidelinesModal = true;
  document.body.style.overflow = 'hidden';
}

closeGuidelines() {
  this.showGuidelinesModal = false;
  document.body.style.overflow = 'auto';
}
```

**In your template:**
```html
<!-- Trigger Button -->
<button (click)="openGuidelines()" 
        class="text-sm text-blue-500 hover:underline">
  📋 Read Community Guidelines
</button>

<!-- Guidelines Modal -->
<div *ngIf="showGuidelinesModal" 
     class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
     (click)="closeGuidelines()">
  <div class="bg-gray-900 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
       (click)="$event.stopPropagation()">
    <!-- Close Button -->
    <button (click)="closeGuidelines()" 
            class="absolute top-4 right-4 text-white hover:text-gray-300">
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
    
    <app-listing-guidelines></app-listing-guidelines>
  </div>
</div>
```

### Option 4: Add to Sidenav Menu
Add link to sidenav navigation:

**In sidenav.component.html:**
```html
<a routerLink="/listing-guidelines" 
   routerLinkActive="bg-gray-700"
   class="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors">
  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
  </svg>
  <span>Listing Guidelines</span>
</a>
```

## 🎯 Integration Ideas

### 1. First-Time Listing Notice
Show guidelines to users creating their first listing:

```typescript
ngOnInit() {
  const listingCount = this.getUserListingCount();
  if (listingCount === 0) {
    this.showGuidelines = true;
  }
}
```

### 2. Mandatory Acceptance
Require users to acknowledge guidelines:

```typescript
guidelinesAccepted = false;

acceptGuidelines() {
  this.guidelinesAccepted = true;
  localStorage.setItem('guidelines_accepted', 'true');
}

canSubmitListing(): boolean {
  return this.guidelinesAccepted && this.validateProduct();
}
```

Add checkbox:
```html
<div class="flex items-start gap-2 p-4 bg-blue-900/20 rounded-lg">
  <input type="checkbox" 
         [(ngModel)]="guidelinesAccepted"
         id="guidelines-checkbox"
         class="mt-1">
  <label for="guidelines-checkbox" class="text-sm text-gray-300">
    I have read and agree to the 
    <button (click)="openGuidelines()" class="text-blue-400 hover:underline">
      Listing Community Guidelines
    </button>
  </label>
</div>
```

### 3. Inline Help Section
Show specific rules based on validation errors:

```typescript
showRelevantRule(ruleId: number) {
  // Programmatically expand specific rule
  this.guidelinesComponent.rules[ruleId - 1].expanded = true;
}
```

## 🎨 Customization

### Change Colors
Edit `listing-guidelines.component.css`:

```css
/* Primary gradient */
.guidelines-header {
  background: linear-gradient(135deg, #your-color-1 0%, #your-color-2 100%);
}

/* Rule items */
.rule-item {
  background: linear-gradient(135deg, #your-dark-1 0%, #your-dark-2 100%);
}

/* Expanded state */
.rule-item.expanded {
  background: linear-gradient(135deg, #your-accent-1 0%, #your-accent-2 100%);
}
```

### Add Custom Rules
Edit `listing-guidelines.component.ts`:

```typescript
rules: GuidelineRule[] = [
  // ... existing rules
  {
    id: 11,
    title: 'Your Custom Rule',
    description: 'Your custom rule description here.',
    expanded: false
  }
];
```

### Modify Animations
Change transition speed in CSS:

```css
.rule-content {
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1); /* Adjust timing */
}
```

## 📱 Responsive Design
- Desktop: Full accordion with expand/collapse buttons
- Tablet: Adjusted padding and spacing
- Mobile: Hidden bulk actions, optimized layout

## ♿ Accessibility
- Keyboard navigation support
- Focus indicators on interactive elements
- ARIA-compliant structure
- Screen reader friendly

## 🖨️ Print Support
Print styles automatically expand all rules and remove interactive elements.

## 🔗 Quick Links
- Standalone Page: `/listing-guidelines`
- Component: `<app-listing-guidelines></app-listing-guidelines>`

## 📦 Files Created
```
src/app/listing-guidelines/
├── listing-guidelines.component.ts
├── listing-guidelines.component.html
├── listing-guidelines.component.css
└── listing-guidelines-page.component.ts
```

## 🚦 Status
✅ Component created
✅ Routing configured
✅ Fully styled and responsive
✅ Ready to use

## 📝 Notes
- Guidelines can be updated by editing the `rules` array
- Penalty system mentioned in footer can be customized
- All text is easily localizable
- Dark theme matches CycleMart design system

---

**Created:** March 10, 2026  
**Version:** 1.0.0  
**CycleMart** - Olongapo City Bicycle Marketplace
