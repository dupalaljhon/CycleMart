import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListingModalComponent } from './listing-modal.component';

describe('ListingModalComponent', () => {
  let component: ListingModalComponent;
  let fixture: ComponentFixture<ListingModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListingModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
