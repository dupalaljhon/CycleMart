import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserReportMonitoringComponent } from './user-report-monitoring.component';

describe('UserReportMonitoringComponent', () => {
  let component: UserReportMonitoringComponent;
  let fixture: ComponentFixture<UserReportMonitoringComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserReportMonitoringComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserReportMonitoringComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
