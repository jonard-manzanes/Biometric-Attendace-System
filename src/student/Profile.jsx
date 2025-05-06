import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const Profile = () => {
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    course: '',
    year: '',
    role: '',
    email: '',
    studentId: '',
    middleInitial: ''
  });
  const [formData, setFormData] = useState({ ...profileData });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          setFormData(data);
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        throw new Error('No user data found');
      }

      const parsedUser = JSON.parse(storedUser);
      if (!parsedUser.docId) {
        throw new Error('Missing document ID');
      }

      const docRef = doc(db, 'users', parsedUser.docId);
      await updateDoc(docRef, formData);
      
      // Update local storage with new data
      const updatedUser = {
        ...parsedUser,
        ...formData,
        fullName: `${formData.firstName} ${formData.middleInitial ? formData.middleInitial + ' ' : ''}${formData.lastName}`
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setProfileData(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating document:', error);
      setError('Error updating profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        {error}
      </div>
    );
  }

  const fullName = `${profileData.firstName} ${profileData.middleInitial ? profileData.middleInitial + ' ' : ''}${profileData.lastName}`;

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-emerald-700 mb-6">Profile Information</h1>
        
        {!isEditing ? (
          <div className="space-y-6">
            <div className="flex items-center border-b border-gray-200 pb-6">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold text-2xl">
                {profileData.firstName?.charAt(0)}{profileData.lastName?.charAt(0)}
              </div>
              <div className="ml-6">
                <h2 className="text-2xl font-semibold text-gray-800">{fullName}</h2>
                <p className="text-gray-600">
                  {profileData.role?.toUpperCase()} • {profileData.studentId || profileData.email}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">First Name</h3>
                <p className="mt-1 text-lg text-gray-900">{profileData.firstName}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Middle Initial</h3>
                <p className="mt-1 text-lg text-gray-900">{profileData.middleInitial || '-'}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Last Name</h3>
                <p className="mt-1 text-lg text-gray-900">{profileData.lastName}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Role</h3>
                <p className="mt-1 text-lg text-gray-900">{profileData.role?.toUpperCase()}</p>
              </div>
              {profileData.studentId && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500">Student ID</h3>
                  <p className="mt-1 text-lg text-gray-900">{profileData.studentId}</p>
                </div>
              )}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-500">Email</h3>
                <p className="mt-1 text-lg text-gray-900">{profileData.email}</p>
              </div>
              {profileData.course && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500">Course</h3>
                  <p className="mt-1 text-lg text-gray-900">{profileData.course}</p>
                </div>
              )}
              {profileData.year && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500">Year Level</h3>
                  <p className="mt-1 text-lg text-gray-900">{profileData.year}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsEditing(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Edit Profile
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:border-emerald-500 focus:ring focus:ring-emerald-200"
                  required
                />
              </div>
              <div>
                <label htmlFor="middleInitial" className="block text-sm font-medium text-gray-700 mb-1">
                  Middle Initial
                </label>
                <input
                  type="text"
                  id="middleInitial"
                  name="middleInitial"
                  value={formData.middleInitial}
                  onChange={handleChange}
                  maxLength="1"
                  className="block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:border-emerald-500 focus:ring focus:ring-emerald-200"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:border-emerald-500 focus:ring focus:ring-emerald-200"
                  required
                />
              </div>
              {profileData.role === 'student' && (
                <>
                  <div>
                    <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 mb-1">
                      Student ID
                    </label>
                    <input
                      type="text"
                      id="studentId"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:border-emerald-500 focus:ring focus:ring-emerald-200"
                      required
                      disabled
                    />
                  </div>
                  <div>
                    <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-1">
                      Course
                    </label>
                    <input
                      type="text"
                      id="course"
                      name="course"
                      value={formData.course}
                      onChange={handleChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:border-emerald-500 focus:ring focus:ring-emerald-200"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
                      Year Level
                    </label>
                    <select
                      id="year"
                      name="year"
                      value={formData.year}
                      onChange={handleChange}
                      className="block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:border-emerald-500 focus:ring focus:ring-emerald-200"
                      required
                    >
                      <option value="">Select Year</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="5th Year">5th Year</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm p-3 border focus:border-emerald-500 focus:ring focus:ring-emerald-200"
                  required
                  disabled
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-8">
              <button
                type="button"
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
                onClick={() => {
                  setFormData({ ...profileData });
                  setIsEditing(false);
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-6 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Profile;