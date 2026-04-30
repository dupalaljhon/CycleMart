import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-prompt',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="showInstallPrompt" class="fixed bottom-3 left-3 right-3 sm:bottom-5 sm:left-5 sm:right-5 md:left-auto md:right-6 md:max-w-md z-50 animate-slide-up">
      <div class="prompt-card rounded-2xl shadow-2xl p-5 sm:p-6 border border-emerald-200/80 backdrop-blur-sm">
        <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div class="orb orb-top"></div>
          <div class="orb orb-bottom"></div>
        </div>

        <button
          (click)="dismissPrompt()"
          class="close-btn absolute top-3 right-3 text-gray-500 hover:text-gray-800 transition-colors"
          aria-label="Close install prompt">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <div class="relative z-10 flex items-start gap-4">
          <div class="logo-wrap flex-shrink-0">
            <img
              src="assets/images/cyclemart-logo2.png"
              alt="CycleMart logo"
              class="logo-img"
              loading="lazy"
            />
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold tracking-[0.16em] text-emerald-700 uppercase mb-1">Quick Access</p>
            <h3 class="text-lg sm:text-xl font-bold text-gray-900 leading-tight mb-1">Install CycleMart</h3>
            <p class="text-sm text-gray-700 mb-4">Get faster loading, app-like navigation, and one-tap access right from your home screen.</p>

            <div class="flex flex-col sm:flex-row gap-2">
              <button
                (click)="installApp()"
                class="install-btn flex-1 px-4 py-2.5 rounded-xl font-semibold">
                Install App
              </button>
              <button
                (click)="dismissPrompt()"
                class="later-btn px-4 py-2.5 rounded-xl font-medium text-gray-700">
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .prompt-card {
      position: relative;
      background:
        linear-gradient(135deg, rgba(236, 253, 245, 0.92), rgba(255, 255, 255, 0.96) 45%, rgba(240, 253, 250, 0.94));
    }

    .orb {
      position: absolute;
      border-radius: 9999px;
      filter: blur(20px);
      opacity: 0.35;
    }

    .orb-top {
      width: 110px;
      height: 110px;
      top: -40px;
      right: -20px;
      background: radial-gradient(circle, #34d399 0%, rgba(52, 211, 153, 0) 70%);
    }

    .orb-bottom {
      width: 120px;
      height: 120px;
      bottom: -46px;
      left: -28px;
      background: radial-gradient(circle, #6ee7b7 0%, rgba(110, 231, 183, 0) 70%);
    }

    .logo-wrap {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(145deg, #ffffff, #dcfce7);
      border: 1px solid rgba(16, 185, 129, 0.28);
      box-shadow: 0 10px 18px rgba(16, 185, 129, 0.18);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-img {
      width: 38px;
      height: 38px;
      object-fit: contain;
    }

    .install-btn {
      color: #ffffff;
      background: #2e7d32;
      box-shadow: 0 10px 24px rgba(46, 125, 50, 0.22);
      transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
    }

    .install-btn:hover {
      transform: translateY(-1px);
      background: #25692a;
      box-shadow: 0 14px 26px rgba(46, 125, 50, 0.28);
    }

    .later-btn {
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.35);
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }

    .later-btn:hover {
      background: rgba(255, 255, 255, 0.95);
      border-color: rgba(100, 116, 139, 0.5);
    }

    .close-btn {
      z-index: 20;
    }

    @keyframes slide-up {
      from {
        transform: translateY(26px) scale(0.98);
        opacity: 0;
      }
      to {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }

    .animate-slide-up {
      animation: slide-up 0.35s cubic-bezier(0.22, 1, 0.36, 1);
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
