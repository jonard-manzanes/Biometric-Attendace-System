import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './auth/Login';
import SignUp from './auth/SignUp';
import ProtectedRoute from './auth/ProtectedRoute';

import StudentLayout from './student/StudentLayout'; // ✅ Import layout
import StudentDashboard from './student/Dashboard';
import StudentAttendance from './student/Attendance';
import StudentProfile from './student/Profile';

import TeacherDashboard from './teacher/Dashboard';
import AdminDashboard from './admin/Dashboard';

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
          path="/teacher/dashboard"
          element={
            <ProtectedRoute role="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
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
