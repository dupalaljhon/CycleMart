import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketProductsComponent } from './market-products.component';

describe('MarketProductsComponent', () => {
  let component: MarketProductsComponent;
  let fixture: ComponentFixture<MarketProductsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketProductsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
