import { Component } from '@angular/core';

import { AdminSidenavComponent } from '../admin-sidenav/admin-sidenav.component';

@Component({
  selector: 'app-user-list',
  imports: [AdminSidenavComponent, ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css'
})
export class UserListComponent {

}
