import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, onSnapshot, doc, updateDoc } from 'firebase/firestore';

const AccessCodes = () => {
  const [currentInvite, setCurrentInvite] = useState({
    code: '',
    expiresAt: null,
    id: null // Store the document ID for updates
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newExpiration, setNewExpiration] = useState('');

  // Function to select and set the current invite code
  const selectCurrentInvite = (codes) => {
    if (codes.length === 0) {
      setError('No invite codes available');
      return;
    }

    // Sort codes by timestamp if available (newest first)
    const sortedCodes = [...codes].sort((a, b) => 
      (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0)
    );

    // Select the most recent code that hasn't expired
    const now = new Date();
    const activeCode = sortedCodes.find(code => 
      !code.expiresAt || code.expiresAt.toDate() > now
    ) || sortedCodes[0];

    // Set expiration to 2 days from now if not specified
    const expiresAt = activeCode.expiresAt?.toDate() || 
      new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    setCurrentInvite({
      code: activeCode.InviteCode || activeCode.inviteCode || activeCode.code,
      expiresAt,
      id: activeCode.id
    });

    // Schedule next rotation
    const timeUntilExpiry = expiresAt - now;
    if (timeUntilExpiry > 0) {
      const timer = setTimeout(() => {
        selectCurrentInvite(codes);
      }, timeUntilExpiry);

      return () => clearTimeout(timer);
    }
  };

  const handleUpdateExpiration = async () => {
    if (!newExpiration) return;
    
    try {
      setLoading(true);
      const codeDoc = doc(db, 'UniversityCode', currentInvite.id);
      
      await updateDoc(codeDoc, {
        expiresAt: new Date(newExpiration)
      });

      // Refresh the data
      const querySnapshot = await getDocs(collection(db, 'UniversityCode'));
      const updatedCodes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      selectCurrentInvite(updatedCodes);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update expiration time');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe;
    let rotationTimer;

    const setupInviteSystem = async () => {
      try {
        // First load all codes
        const querySnapshot = await getDocs(collection(db, 'UniversityCode'));
        const initialCodes = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        selectCurrentInvite(initialCodes);

        // Set up real-time listener for database updates
        unsubscribe = onSnapshot(collection(db, 'UniversityCode'), (snapshot) => {
          const updatedCodes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          selectCurrentInvite(updatedCodes);
        });

      } catch (err) {
        setError('Failed to load invite codes');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    setupInviteSystem();

    return () => {
      if (unsubscribe) unsubscribe();
      if (rotationTimer) clearTimeout(rotationTimer);
    };
  }, []);

  // Format expiration time
  const formatExpiration = (date) => {
    if (!date) return '';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xs mx-auto p-4 bg-rose-100 rounded-lg shadow border-l-4 border-rose-500">
        <p className="text-rose-800 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-slate-50 p-6 rounded-lg shadow-sm border border-slate-200 text-center">
        <h3 className="text-lg font-medium text-slate-800 mb-2">Teacher Access Code</h3>
        <div className="bg-indigo-50 p-4 rounded-md mb-3">
          <code className="text-2xl font-bold text-emerald-600">{currentInvite.code}</code>
        </div>
        
        {currentInvite.expiresAt && (
          <div className="text-sm text-slate-600 mb-3">
            <span className="font-medium">Expires:</span> {formatExpiration(currentInvite.expiresAt)}
          </div>
        )}

        {!isEditing ? (
          <button
            onClick={() => {
              setIsEditing(true);
              setNewExpiration(currentInvite.expiresAt.toISOString().slice(0, 16));
            }}
            className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
          >
            Change Expiration
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Expiration</label>
              <input
                type="datetime-local"
                value={newExpiration}
                onChange={(e) => setNewExpiration(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex space-x-2 justify-center">
              <button
                onClick={handleUpdateExpiration}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-3">
          This code automatically updates when expired
        </p>
      </div>
    </div>
  );
};

export default AccessCodes;