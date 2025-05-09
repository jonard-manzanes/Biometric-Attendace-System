import React, { useState, useEffect } from "react";
import { Bell, Home, CalendarCheck, User, LogOut, Menu } from "lucide-react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import Swal from "sweetalert2";

export default function TeacherLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = location.pathname.split("/")[2] || "dashboard";

  useEffect(() => {
    const fetchProfileData = async () => {
      setLoading(true);
      try {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
          setError('No user data found. Please login again.');
          setLoading(false);
          return;
        }

        const parsedUser = JSON.parse(storedUser);
        if (!parsedUser.docId) {
          setError('Missing document ID. Please login again.');
          setLoading(false);
          return;
        }

        const docRef = doc(db, 'users', parsedUser.docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfileData(data);
        } else {
          setError('No profile data found for this user.');
        }
      } catch (error) {
        console.error('Error getting document:', error);
        setError('Error fetching profile data.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth < 768) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  const handleNavigate = (path) => {
    navigate(`/teacher/${path}`);
    if (window.innerWidth < 768) setMobileSidebarOpen(false);
  };

  const handleLogout = () => {
    Swal.fire({
      title: "Are you sure?",
      text: "You will be logged out of your account.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, log out",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem("user");
        localStorage.removeItem("userDocId");
        localStorage.removeItem("currentUserId");
        localStorage.removeItem("studentId");
        navigate("/login");
      }
    });
  };

  // Function to get user initials
  const getUserInitials = () => {
    if (!profileData) return 'T'; // Default to 'T' for Teacher
    const firstInitial = profileData.firstName ? profileData.firstName.charAt(0) : '';
    const lastInitial = profileData.lastName ? profileData.lastName.charAt(0) : '';
    return `${firstInitial}${lastInitial}`.toUpperCase() || 'T';
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-opacity-50 z-20 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? "w-64" : "w-20"} ${
          mobileSidebarOpen ? "fixed inset-y-0 left-0 z-30" : "hidden md:block"
        } bg-emerald-800 text-white flex flex-col justify-between transition-all duration-300 ease-in-out`}
      >
        <div>
          <div className="p-4 flex items-center justify-between">
            {sidebarOpen ? (
              <>
                <div>
                  <h1 className="text-xl font-bold text-emerald-200">BIO-TRACK</h1>
                  <p className="text-sm opacity-75">Biometric Attendance System</p>
                </div>
                <button onClick={toggleSidebar} className="text-white hover:text-emerald-200">
                  <Menu size={20} />
                </button>
              </>
            ) : (
              <button
                onClick={toggleSidebar}
                className="text-white hover:text-emerald-200 mx-auto"
              >
                <Menu size={20} />
              </button>
            )}
          </div>

          <div className="mt-6">
            <SidebarLink
              icon={<Home size={20} />}
              text="Dashboard"
              active={currentPage === "dashboard"}
              onClick={() => handleNavigate("dashboard")}
              sidebarOpen={sidebarOpen}
            />
            <SidebarLink
              icon={<CalendarCheck size={20} />}
              text="Classes"
              active={currentPage === "classes"}
              onClick={() => handleNavigate("classes")}
              sidebarOpen={sidebarOpen}
            />
            <SidebarLink
              icon={<User size={20} />}
              text="Reports"
              active={currentPage === "reports"}
              onClick={() => handleNavigate("reports")}
              sidebarOpen={sidebarOpen}
            />
          </div>
        </div>

        <div className="mb-4">
          <SidebarLink
            icon={<LogOut size={20} />}
            text="Logout"
            active={false}
            onClick={handleLogout}
            sidebarOpen={sidebarOpen}
          />
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 ${!sidebarOpen && "md:ml-0"} transition-all duration-300 ease-in-out`}
      >
        <header className="bg-white shadow-sm">
          <div className="flex justify-between items-center px-4 md:px-6 py-3">
            <div className="flex items-center">
              <button
                onClick={toggleSidebar}
                className="mr-4 p-1 text-gray-600 hover:text-emerald-700 md:hidden"
              >
                <Menu size={24} />
              </button>
              <h2 className="text-lg md:text-xl font-semibold text-gray-800 capitalize">
                {currentPage.replace(/-/g, " ")}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-1 md:p-2 text-gray-600 hover:text-emerald-700 relative">
                <Bell size={20} />
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
              </button>
              <div className="flex items-center space-x-2">
                {sidebarOpen && profileData?.firstName && (
                  <span className="text-sm font-medium text-gray-700">
                    {profileData.firstName} {profileData.lastName}
                  </span>
                )}
                <div className="h-8 w-8 rounded-full bg-emerald-700 flex items-center justify-center text-emerald-100 font-medium">
                  {getUserInitials()}
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 overflow-auto h-full">
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarLink({ icon, text, active, onClick, sidebarOpen }) {
  return (
    <button
      className={`flex items-center w-full px-4 py-3 my-1 rounded-md mx-2 transition-colors duration-200 ${
        active
          ? "bg-emerald-900 text-emerald-200 font-medium"
          : "text-green-100 hover:bg-emerald-900 hover:text-white"
      }`}
      onClick={onClick}
      title={!sidebarOpen ? text : ""}
    >
      <span className={`${sidebarOpen ? "mr-3" : "mx-auto"}`}>{icon}</span>
      {sidebarOpen && <span>{text}</span>}
    </button>
  );
}