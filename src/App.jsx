import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./auth/Login";
import SignUp from "./auth/SignUp";
import VerifyEmail from "./auth/VerifyEmail";
import TeacherSignUp from "./auth/TeacherSignUp";
import ProtectedRoute from "./auth/ProtectedRoute";

import StudentLayout from "./student/StudentLayout";
import StudentDashboard from "./student/Dashboard";
import StudentAttendance from "./student/Attendance";
import StudentProfile from "./student/Profile";

import TeacherLayout from "./teacher/TeacherLayout";
import TeacherDashboard from "./teacher/Dashboard";
import TeacherClasses from "./teacher/Classes";
import TeacherReports from "./teacher/Reports";
import Excuses from "./teacher/Excuses";
import ClassDetail from "./teacher/ClassDetail"; // new import

import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/Dashboard";
import UserManagement from "./admin/UserManagement";
import Reports from "./admin/Reports";
import AccessCodes from "./admin/AccessCodes";
import QuickAttendance from "./auth/quickAttendance";
import TaskingStaff from "./admin/TaskingStaff";

import StaffLayout from "./staff/StaffLayout";
import VerifyClasses from "./staff/VerifyClasses";
import StaffDSashboard from "./staff/Dashboard";
import StaffProfile from "./staff/Profile";


import DepartmentLayout from "./departments/DepartmentLayout";
import DepartmentDashboard from "./departments/Dashboard";
import DepartmentInstrutor from "./departments/Instructors";
import DepartmentReports from "./departments/Reports";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/teacher-signup" element={<TeacherSignUp />} />
        <Route path="/quick-attendance" element={<QuickAttendance />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route
          path="/student"
          element={
            <ProtectedRoute role="student">
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>

        <Route
          path="/teacher"
          element={
            <ProtectedRoute role="teacher">
              <TeacherLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="classes" element={<TeacherClasses />} />
          {/* New detailed view route */}
          <Route path="classes/:id" element={<ClassDetail />} />
          <Route path="excused-absences" element={<Excuses />} />
          <Route path="reports" element={<TeacherReports />} />
        </Route>

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="user-management" element={<UserManagement />} />
          <Route path="access-codes" element={<AccessCodes />} />
          <Route path="tasking-staff" element={<TaskingStaff />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route
          path="/staff"
          element={
            <ProtectedRoute role="staff">
              <StaffLayout />
            </ProtectedRoute>
          }
        >
        <Route path="dashboard" element={<StaffDSashboard />} />
        <Route path="verify-classes" element={<VerifyClasses />} />
        <Route path="profile" element={<StaffProfile />} />
        </Route>


        <Route
          path="/department"
          element={
            <ProtectedRoute role="departmentHead">
              <DepartmentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DepartmentDashboard />} />
          <Route path="instructors" element={<DepartmentInstrutor />} />
          <Route path="reports" element={<DepartmentReports />} />
        </Route>
        

      </Routes>




    </Router>
  );
}

export default App;
