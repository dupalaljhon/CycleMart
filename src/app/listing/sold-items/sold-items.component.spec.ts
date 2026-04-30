import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoldItemsComponent } from './sold-items.component';

describe('SoldItemsComponent', () => {
  let component: SoldItemsComponent;
  let fixture: ComponentFixture<SoldItemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SoldItemsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SoldItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
