import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface BuyingStep {
  id: number;
  title: string;
  description: string;
  expanded: boolean;
}

@Component({
  selector: 'app-buying-guidelines',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './buying-guidelines.component.html',
  styleUrl: './buying-guidelines.component.css'
})
export class BuyingGuidelinesComponent {
  steps: BuyingStep[] = [
    {
      id: 1,
      title: 'Search and Compare Listings',
      description: 'Use product filters and read item details carefully. Compare price, condition, and location before messaging the seller.',
      expanded: false
    },
    {
      id: 2,
      title: 'Check Seller Credibility',
      description: 'Review seller profile information, response behavior, and listing quality. Avoid rushing into deals without confirming seller details.',
      expanded: false
    },
    {
      id: 3,
      title: 'Ask Important Questions',
      description: 'Confirm product condition, hidden issues, exact inclusions, and reason for selling. Request updated photos if needed.',
      expanded: false
    },
    {
      id: 4,
      title: 'Agree on Price and Terms',
      description: 'Finalize total price, payment method, and meetup or delivery arrangement in the chat before proceeding.',
      expanded: false
    },
    {
      id: 5,
      title: 'Reserve if Needed',
      description: 'If you need time to prepare payment, ask the seller to reserve the item. Confirm reservation duration and expiry.',
      expanded: false
    },
    {
      id: 6,
      title: 'Meet Safely for Inspection',
      description: 'Choose a public and secure location. Inspect the item physically and verify key parts or performance before paying.',
      expanded: false
    },
    {
      id: 7,
      title: 'Complete the Transaction',
      description: 'Pay only after proper inspection and mutual agreement. Keep proof of payment and transaction details for your records.',
      expanded: false
    },
    {
      id: 8,
      title: 'Mark Complete and Rate',
      description: 'After successful purchase, ensure the item status is updated and submit your rating to help other buyers.',
      expanded: false
    }
  ];

  toggleStep(step: BuyingStep) {
    step.expanded = !step.expanded;
  }

  closeAllSteps() {
    this.steps.forEach(step => step.expanded = false);
  }

  expandAllSteps() {
    this.steps.forEach(step => step.expanded = true);
  }
}
