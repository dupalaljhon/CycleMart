import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListingMonitoringComponent } from './listing-monitoring.component';

describe('ListingMonitoringComponent', () => {
  let component: ListingMonitoringComponent;
  let fixture: ComponentFixture<ListingMonitoringComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListingMonitoringComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ListingMonitoringComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
