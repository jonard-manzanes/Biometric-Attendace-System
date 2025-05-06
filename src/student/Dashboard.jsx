import React from "react";
import Swal from "sweetalert2";



const Dashboard = () => {



  const joinButtonClick = () => {
    Swal.fire({
      title: 'Join Subject',
      input: 'text',
      inputPlaceholder: 'code here',
      confirmButtonText: 'Join',
      inputValidator: (value) => {
        if(!value) {
          return 'Input the code!';
        }
        
      }
    })
  }










  return (
    <div>
      <div className="flex flex-col">
        <h1 className="mt-2 text-center md:text-start md:text-2xl mb-2">Welcome to Dashboard</h1>
        <button className="mt-2 bg-emerald-300 py-2 px-6 text-sm rounded text-white md:w-40"
        onClick={joinButtonClick}>
          Join
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
