import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./auth/Login";
import SignUp from "./auth/SignUp";
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

import Staff from "./staff/Staff_page";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/teacher-signup" element={<TeacherSignUp />} />
        <Route path="/quick-attendance" element={<QuickAttendance />} />

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
          <Route path="reports" element={<Reports />} />
        </Route>

        <Route
          path="/staff"
          element={
            <ProtectedRoute role="staff">
              <Staff />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
