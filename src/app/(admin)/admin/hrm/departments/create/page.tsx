import { redirect } from 'next/navigation';

export default function CreateDepartmentRedirectPage() {
  redirect('/admin/hrm/departments');
}
