import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListingApprovalComponent } from './listing-approval.component';

describe('ListingApprovalComponent', () => {
  let component: ListingApprovalComponent;
  let fixture: ComponentFixture<ListingApprovalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingApprovalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListingApprovalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
