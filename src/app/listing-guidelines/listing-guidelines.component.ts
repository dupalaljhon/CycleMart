import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface GuidelineRule {
  id: number;
  title: string;
  description: string;
  expanded: boolean;
}

@Component({
  selector: 'app-listing-guidelines',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './listing-guidelines.component.html',
  styleUrl: './listing-guidelines.component.css'
})
export class ListingGuidelinesComponent {
  rules: GuidelineRule[] = [
    {
      id: 1,
      title: 'Only Bicycle-Related Items',
      description: 'List only bicycles, bicycle parts, components, accessories, and cycling gear. Items unrelated to cycling (e.g., motorcycle parts, general sports equipment) are strictly prohibited and will be removed.',
      expanded: false
    },
    {
      id: 2,
      title: 'Provide Accurate Descriptions',
      description: 'Ensure your listings are accurate and honest. Include detailed specifications, actual condition, brand, model, and any defects or wear. Misleading descriptions, false specifications, or bait-and-switch tactics are prohibited and may result in account suspension.',
      expanded: false
    },
    {
      id: 3,
      title: 'Use Clear, Original Photos',
      description: 'Upload clear, high-quality photos of the actual item you\'re selling. Stock photos or images from other sources are not allowed unless you\'re selling brand new items with official product images. Show all angles and any imperfections for used items.',
      expanded: false
    },
    {
      id: 4,
      title: 'Set Fair & Realistic Prices',
      description: 'Price your items reasonably based on condition, age, and market value. Extreme price manipulation, artificially inflated prices, or pricing intended to mislead buyers will result in listing removal. Be transparent about pricing for both sale and trade listings.',
      expanded: false
    },
    {
      id: 5,
      title: 'No Prohibited or Illegal Items',
      description: 'Do not list stolen goods, counterfeit products, or items that violate local laws. Original receipts or proof of ownership may be requested. Any suspected illegal activity will be reported to authorities.',
      expanded: false
    },
    {
      id: 6,
      title: 'Respond to Inquiries Promptly',
      description: 'Be responsive to buyer messages and questions within 24 hours. Update your listing status (sold/traded) immediately after completing a transaction. Maintain professional communication and respect all users.',
      expanded: false
    },
    {
      id: 7,
      title: 'Complete Transactions Safely',
      description: 'Meet in safe, public locations for in-person transactions. Never share sensitive personal or financial information through the platform. Use secure payment methods and document all transactions. Report any suspicious activity immediately.',
      expanded: false
    },
    {
      id: 8,
      title: 'No Spam or Duplicate Listings',
      description: 'Create only one listing per item. Do not post the same item multiple times or create duplicate listings to gain visibility. Excessive reposting or spam will result in all listings being removed and potential account restrictions.',
      expanded: false
    },
    {
      id: 9,
      title: 'Respect Location Restrictions',
      description: 'CycleMart operates within Olongapo City only. All listings must be available for pickup or delivery within this area. Listings outside this service area will be automatically rejected.',
      expanded: false
    },
    {
      id: 10,
      title: 'Update Listing Status',
      description: 'Keep your listings current. Mark items as "Sold" or "Traded" immediately after completing a transaction. Delete or archive listings that are no longer available. Inactive or outdated listings may be removed by administrators.',
      expanded: false
    }
  ];

  toggleRule(rule: GuidelineRule) {
    rule.expanded = !rule.expanded;
  }

  closeAllRules() {
    this.rules.forEach(rule => rule.expanded = false);
  }

  expandAllRules() {
    this.rules.forEach(rule => rule.expanded = true);
  }
}
