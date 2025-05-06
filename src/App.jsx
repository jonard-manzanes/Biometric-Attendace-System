import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./auth/Login";
import SignUp from "./auth/SignUp";
import ProtectedRoute from "./auth/ProtectedRoute";

import StudentLayout from "./student/StudentLayout";
import StudentDashboard from "./student/Dashboard";
import StudentAttendance from "./student/Attendance";
import StudentProfile from "./student/Profile";

import TeacherLayout from "./teacher/TeacherLayout";
import TeacherDashboard from "./teacher/Dashboard";
import TeacherClasses from './teacher/Classes';
import TeacherReports from "./teacher/Reports";

import AdminDashboard from "./admin/Dashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* ✅ Student Routes with layout */}
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

        {/* ✅ Other Roles */}
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
          <Route path="reports" element={<TeacherReports />} />
        </Route>

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
