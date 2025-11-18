import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="showInstallPrompt" class="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-slide-up">
      <div class="bg-white rounded-2xl shadow-2xl p-6 border-2 border-black">
        <div class="flex items-start gap-4">
          <!-- App Icon -->
          <div class="bg-black rounded-xl p-3 flex-shrink-0">
            <svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 20a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM5 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm14 6a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-7-7l1.5 3h3l-1.5-3H12zm0-2h4.5c.4 0 .7.2.9.5L19 11h1v2h-2.5l-.5-1h-4l-.5 1H10v-2h2V8h-1.5c-.3 0-.5-.2-.5-.5s.2-.5.5-.5H12z"/>
            </svg>
          </div>
          
          <!-- Content -->
          <div class="flex-1">
            <h3 class="text-lg font-bold text-gray-900 mb-1">Install CycleMart</h3>
            <p class="text-sm text-gray-600 mb-4">Install our app for a better experience and quick access!</p>
            
            <div class="flex gap-2">
              <button 
                (click)="installApp()"
                class="flex-1 bg-black text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors">
                Install
              </button>
              <button 
                (click)="dismissPrompt()"
                class="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                Not now
              </button>
            </div>
          </div>
          
          <!-- Close button -->
          <button 
            (click)="dismissPrompt()"
            class="text-gray-400 hover:text-gray-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes slide-up {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
  `]
})
export class PwaPromptComponent implements OnInit {
  showInstallPrompt = false;

  constructor(private pwaService: PwaService) {}

  ngOnInit() {
    // Show install prompt after 5 seconds if available
    setTimeout(() => {
      if (this.pwaService.canInstall && !this.isDismissed()) {
        this.showInstallPrompt = true;
      }
    }, 5000);
  }

  async installApp() {
    await this.pwaService.installPwa();
    this.showInstallPrompt = false;
  }

  dismissPrompt() {
    this.showInstallPrompt = false;
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  }

  private isDismissed(): boolean {
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (!dismissed) return false;
    
    const dismissedTime = parseInt(dismissed, 10);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedTime < sevenDays;
  }
}
