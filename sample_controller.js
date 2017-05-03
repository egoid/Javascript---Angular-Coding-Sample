(function(module) {

  "use strict";

  var EmployerInboxCtrl;
  EmployerInboxCtrl.$inject=['CURRENT_USER', 'dashboardFactory' ,'gaService', 'localStorageManager', '$http', '$log', '$state','inboxService','employeeService','employerService','applicantsService','$scope','utilityService'];

  function EmployerInboxCtrl(CURRENT_USER, dashboardFactory, gaService, localStorageManager, $http, $log, $state, inboxService, employeeService, employerService, applicantsService, $scope, utilityService) {
  
    var vm = this;
    
    vm.about_msg = 'Open Position';
    vm.employerData = localStorageManager.retrieve(CURRENT_USER);
    vm.has_more_than_one_job = false;
    vm.has_msgs = 0;
    vm.message_keys = {};
    vm.message_threads = {};
    vm.selected_logs = [];
    vm.select_thread = select_thread;
    vm.send_message = send_message;
    vm.your_jobs = [];
    vm.your_jobs_keys = {};
    
    let job_applications = {};

    activate();

    function activate() {
      var tasks = [ _your_jobs , _message_keys , _job_applications , _message_threads , _job_check ]
      var count = -1;

      $scope.$on('done' , function(event, val) {
        count+= 1
        tasks[count]();
      });

      $scope.$emit('done' , true)

    };

    function _your_jobs() {
      if (!(localStorageManager.retrieve('your_jobs'))) {
          employerService.get_jobs_by_employer({employer_id : vm.employerData.user_id}).then(function(res) {
            vm.your_jobs = res.data;
            vm.your_jobs.forEach(function(job, i ) {
              vm.your_jobs_keys[job.job.job_id] = job;

              if (i === vm.your_jobs.length -1) {
                $scope.$emit('done' , true )
              }
            });
          });
      } else {
        vm.your_jobs = JSON.parse(localStorageManager.retrieve('your_jobs'));
        vm.your_jobs.forEach(function(job) {
          vm.your_jobs_keys[job.job.job_id] = job;

          if (i === vm.your_jobs.length -1) {
            $scope.$emit('done' , true )
          }
        });
      } 
    };
    function _message_keys() {
      dashboardFactory.redirect_if_no_jobs(vm.your_jobs)
      vm.your_jobs.forEach(function(job,i) {
        inboxService.get_messages(job.job.job_id).then(function(res) {
          comile_message_keylist(res.data , job.job.job_id );
          if (i === vm.your_jobs.length -1) {
            $scope.$emit('done' , true )
          }
        })
      });
    };
    function _job_applications() {
      applicantsService.get_tracker(vm.employerData.user_id).then(function(res) {
        if (res.data.length > 1) {
          res.data.forEach(function(job_application, i) {
              if (job_applications[job_application.applied_job_id]) {
                job_applications[job_application.applied_job_id][job_application.employee_id] = job_application
              } else {
                job_applications[job_application.applied_job_id] = {}
                job_applications[job_application.applied_job_id][job_application.employee_id] = job_application
              }
              if (i === res.data.length -1) {
                $scope.$emit('done' , true )
              }              
          });
        } else {
          $scope.$emit('done' , true )
        }
      })
    };
    function _message_threads() {
      vm.your_jobs.forEach(function(job,i) {
        if (Object.keys(vm.message_keys).length > 0) {        
          for (var key in vm.message_keys) {
            for (var inner_key in vm.message_keys[key]) {
            
                if (vm.message_keys[key][inner_key][job.job.job_id]) {

                  vm.message_threads[inner_key+"_"+key+"_"+job.job.job_id] = {} 
                  lookup_employee(inner_key, key, job.job.job_id)

                  if (i === vm.your_jobs.length - 1) {
                    $scope.$emit('done' , true )
                  }
                } 
            }
          };
        } else {
          if (i === vm.your_jobs.length - 1) {
             $scope.$emit('done' , true ) 
           }
        }

      });
    };  
    function _job_check() {    
      if (vm.has_more_than_one_job === false) {
        display_no_msg_alert();
      };
    }
   
    function lookup_employee(inner_key, key, job_id) {  
      $("#has_msgs").hide();
      employeeService.get(inner_key).then(function(res) {
         vm.message_threads[inner_key+"_"+key+"_"+job_id].name = res.data.first_name + " " + res.data.last_name;
         vm.message_threads[inner_key+"_"+key+"_"+job_id].job_position = vm.your_jobs_keys[job_id].job.title;
         vm.message_threads[inner_key+"_"+key+"_"+job_id].company_name = vm.your_jobs_keys[job_id].company.name;
         vm.message_threads[inner_key+"_"+key+"_"+job_id].status = switch_status(job_applications[job_id][inner_key].status)
         vm.message_threads[inner_key+"_"+key+"_"+job_id].to_source_id = inner_key;
         vm.message_threads[inner_key+"_"+key+"_"+job_id].job_id = job_id;
      })
    };
    function prepare_msg_data(msg) {
        if (vm.employerData.user_id === msg.from_source_id) {
          msg.source = "employer"
        } else {
          msg.source = "you"
        };
        if (msg.from_source_id !== vm.employerData.user_id) {
          msg.to_source_id = msg.to_source_id ^ msg.from_source_id;
          msg.from_source_id = msg.to_source_id ^ msg.from_source_id;
          msg.to_source_id = msg.to_source_id ^ msg.from_source_id;
        };
        if (msg.message_date) {
        msg.date_string = utilityService.transform_datetimes(String(msg.message_date))
        }
        if(msg.request_interview_date){
          msg.request_interview_date = msg.request_interview_date.split("_") || null
          if (msg.request_interview_date[0] === 'fined') {msg.request_interview_date = null }
        };
        if(msg.request_interview_date_two){
          msg.request_interview_date_two = msg.request_interview_date_two.split("_") || null
          if (msg.request_interview_date_two[0] === 'fined') {msg.request_interview_date = null }
        };
        if(msg.request_interview_date_three){
          msg.request_interview_date_three = msg.request_interview_date_three.split("_") || null
          if (msg.request_interview_date_three[0] === 'fined') {msg.request_interview_date = null }
        };
        return msg
    };
    function comile_message_keylist(job_list , job_id) {


//CREATE MESSAGE KEY list
// - Creates a sorted key list where the greater of the from_source_id and to_source_id is used as the first key
// - and the lower of the from_source_id and to_source_id is used as the second key.
  
        job_list.forEach(function(msg, i) {
          vm.has_more_than_one_job = true;
          msg = prepare_msg_data(msg);

          if (vm.message_keys[String(msg.from_source_id)]) {
            if (vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)]) {
              if (vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id]) {
                vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id].push(msg)
                vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id].sort(function(a,b) {
                  return new Date(b.message_date) - new Date(a.message_date);
                });

              } else {
                vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id] = [];
                vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id].push(msg)

              };
            } else {
              vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)] = {};
              vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id] = [];
              vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id].push(msg)

            }
          } else {
            vm.message_keys[String(msg.from_source_id)] = {};
            vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)] = {};
            vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id] = []
            vm.message_keys[String(msg.from_source_id)][String(msg.to_source_id)][job_id].push(msg)

          };

          if (i === job_list.length - 1) {
            $scope.$emit('compile_complete' , true) 
          }

        });
    };


//** Exposed Functions
//**

    function select_thread(employee_id, employer, job_id) {
      $("#has_no_msgs_header").hide();
      $("#has_msgs_header").show();
      $("#about_message_footer").show();
      vm.selected_logs = vm.message_keys[vm.employerData.user_id][employee_id][job_id]
      .sort(function(a,b) {
        return new Date(b.message_date) - new Date(a.message_date);
      });
      vm.selected_user = vm.message_threads[employee_id+"_"+vm.employerData.user_id+"_"+job_id]
    };
    function send_message() {
      var rtn_obj = {
        from_source_id: vm.employerData.user_id,
        to_source_id: vm.selected_user.to_source_id,
        job_application_id: vm.selected_user.job_id,
        message: vm.message, 
        message_status: 0,
        message_source: vm.about_msg,
        request_interview_date : null,
        request_interview_date_2 : null,
        request_interview_date_3 : null,
      };
      applicantsService.send_message(rtn_obj).then(function(res){
        if (res.status === 200) {
          vm.message = "";
          inboxService.get_messages(vm.selected_user.job_id).then(function(res) {
                comile_message_keylist(res.data, vm.selected_user.job_id);
                $scope.$on('compile_complete', function(event, val) {
                  vm.selected_logs = [];
                  vm.select_thread(vm.selected_user.to_source_id, vm.selected_user.from_source_id, vm.selected_user.job_id )
                })
          });
        }
      })
    };


    function switch_status(string) {
      switch(string) {
        case 'pass':
          return'Pending'
          break;
        case 'contacted':
          return'Phone Screen'
          break;
        case 'contacted_interview_one':
          return'In Person Interview'
          break;            
        case 'contacted_interview_two':
          return'Interview #2'
          break;
        case 'interviewed':
          return'Reference Check'
          break;
        case 'background_check':
          return'Background Check'
          break;
        case 'makingoffer':
          return'Offer Extended'
          break;
        case 'hired':
          return'Hired'
          break;   
        case 'favorited':
          return'Saved Applicants';
          break;
      };
    };
    function display_no_msg_alert() {
      $(".loader").hide();
      $(".company_name").show();
    };


  };


  module.controller('EmployerInboxCtrl', EmployerInboxCtrl);


})(angular.module('Yobs.Controllers'));
