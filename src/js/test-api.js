// Test script for API connectivity
(async () => {
  const API_URL = 'http://localhost:8081/api/tasks';
  
  console.log('Testing API connectivity...');
  
  try {
    // Test API availability
    const response = await fetch(API_URL, { 
      method: 'HEAD',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      console.log('✅ API is available');
      
      // Test GET tasks
      const getTasks = await fetch(API_URL);
      if (getTasks.ok) {
        const tasks = await getTasks.json();
        console.log(`✅ GET tasks successful. Retrieved ${tasks.length} tasks`);
        console.log('Sample tasks:', tasks.slice(0, 2));
      } else {
        console.error('❌ GET tasks failed:', getTasks.status, getTasks.statusText);
      }
      
      // Test POST task
      const testTaskTitle = 'Test task ' + new Date().toISOString();
      const postTask = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: testTaskTitle })
      });
      
      if (postTask.ok) {
        const newTask = await postTask.json();
        console.log('✅ POST task successful:', newTask);
        
        // Test DELETE task
        if (newTask && newTask.id) {
          const deleteTask = await fetch(`${API_URL}/${newTask.id}`, {
            method: 'DELETE'
          });
          
          if (deleteTask.ok) {
            console.log(`✅ DELETE task successful for ID: ${newTask.id}`);
          } else {
            console.error('❌ DELETE task failed:', deleteTask.status, deleteTask.statusText);
          }
        }
      } else {
        console.error('❌ POST task failed:', postTask.status, postTask.statusText);
      }
    } else {
      console.error('❌ API is not available:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ API connectivity test failed with error:', error);
  }
})();
