// Import CSS
import "../css/styles.css";

// API Base URL with environment awareness
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-api-url.com/api/tasks' 
  : 'http://localhost:8081/api/tasks';

// Network utility functions
const networkUtils = {
  isOnline: () => navigator.onLine,
  
  // Retry fetch with exponential backoff
  retryFetch: async (url, options = {}, maxRetries = 3) => {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) throw error;
        
        // Exponential backoff with jitter
        const delay = Math.min(Math.pow(2, retries) * 1000 + Math.random() * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  },
  
  // Check API availability
  checkApiStatus: async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(API_BASE_URL, { 
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error("API status check failed:", error);
      return false;
    }
  },
  
  // Update API status indicator in UI
  updateApiStatusIndicator: async () => {
    const apiStatus = await networkUtils.checkApiStatus();
    const statusElement = document.getElementById('apiStatus') || document.createElement('div');
    statusElement.id = 'apiStatus';
    
    if (apiStatus) {
      statusElement.className = 'text-green-400 text-xs mt-2';
      statusElement.innerHTML = '<i class="fas fa-circle text-xs mr-1"></i> API Connected';
    } else if (networkUtils.isOnline()) {
      statusElement.className = 'text-yellow-400 text-xs mt-2';
      statusElement.innerHTML = '<i class="fas fa-circle text-xs mr-1"></i> API Issues';
    } else {
      statusElement.className = 'text-red-400 text-xs mt-2';
      statusElement.innerHTML = '<i class="fas fa-circle text-xs mr-1"></i> Using Local Data';
    }
    
    const footer = document.querySelector('footer');
    if (footer && !document.getElementById('apiStatus')) {
      footer.prepend(statusElement);
    }
  }
};

// DOM Elements
let addTaskForm;
let taskTitleInput;
let activeTaskListContainer;
let completedTaskListContainer;
let noActiveTasksMessage;
let noCompletedTasksMessage;
let loadingIndicator;
let messageArea;

// --- Local Mock Data Store ---
let allTasks = [
  // Unified task list
  { id: 1, title: "Buy asteroid repellent (mock)", completed: false },
  { id: 2, title: "Walk the dog on Mars (mock)", completed: true },
  { id: 3, title: "Read 'Galaxy Hitchhiker's Guide' (mock)", completed: false },
];
let nextTaskId = 4; // Simple ID generator for local tasks

// --- Local Storage Support ---
const localStorageService = {
  saveToLocalStorage: () => {
    try {
      localStorage.setItem('tasks', JSON.stringify(allTasks));
      localStorage.setItem('nextTaskId', nextTaskId.toString());
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  },
  
  loadFromLocalStorage: () => {
    try {
      const storedTasks = localStorage.getItem('tasks');
      const storedNextTaskId = localStorage.getItem('nextTaskId');
      
      if (storedTasks) {
        allTasks = JSON.parse(storedTasks);
      }
      
      if (storedNextTaskId) {
        nextTaskId = parseInt(storedNextTaskId, 10);
      }
      
      return storedTasks !== null;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return false;
    }
  }
};

// --- Data Synchronization Service ---
const dataSyncService = {
  syncLocalToAPI: async () => {
    if (!networkUtils.isOnline()) return false;
    
    try {
      // Get current API tasks
      const response = await networkUtils.retryFetch(API_BASE_URL);
      if (!response.ok) throw new Error("API unavailable");
      
      const apiTasks = await response.json();
      const apiTaskIds = new Set(apiTasks.map(t => t.id));
      
      // Find local active tasks not in API and sync them
      const localActiveTasks = allTasks.filter(t => !t.completed && !apiTaskIds.has(t.id));
      
      for (const task of localActiveTasks) {
        await dataService.addTask(task.title);
      }
      
      return true;
    } catch (error) {
      console.error("Sync error:", error);
      return false;
    }
  }
};

// --- Data Service (Abstraction for data operations) ---
const dataService = {
  getTasks: async () => {
    try {
      const response = await networkUtils.retryFetch(API_BASE_URL);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const apiTasks = await response.json();
      
      // Validate response format
      if (!Array.isArray(apiTasks)) {
        throw new Error('Invalid API response format');
      }
      
      // Map API tasks to our format with completed field
      const tasks = apiTasks.map(task => ({
        ...task,
        completed: false // API doesn't have completion status, default to false
      }));
      
      // Update our local cache
      allTasks = [...tasks];
      localStorageService.saveToLocalStorage();
      return tasks;
    } catch (error) {
      console.error("API error:", error);
      // Fallback to local data
      return [...allTasks];
    }
  },
  
  addTask: async (title) => {
    try {
      const response = await networkUtils.retryFetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title })
      });
      
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const newTask = await response.json();
      // Add completed status since API doesn't include it
      newTask.completed = false;
      
      // Update local cache
      allTasks.push(newTask);
      localStorageService.saveToLocalStorage();
      return newTask;
    } catch (error) {
      console.error("API error:", error);
      // Fallback to local operation
      const newTask = { id: nextTaskId++, title, completed: false };
      allTasks.push(newTask);
      localStorageService.saveToLocalStorage();
      return newTask;
    }
  },
  
  toggleTaskStatus: async (taskId) => {
    try {
      // Find the task in our local cache
      const taskIndex = allTasks.findIndex((task) => task.id === taskId);
      if (taskIndex === -1) throw new Error("Task not found");
      
      const task = allTasks[taskIndex];
      const newCompletedStatus = !task.completed;
      
      if (newCompletedStatus) {
        // If marking as complete, delete from the API (based on OpenAPI spec)
        const response = await networkUtils.retryFetch(`${API_BASE_URL}/${taskId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        // Update local state
        allTasks[taskIndex].completed = true;
        localStorageService.saveToLocalStorage();
        return allTasks[taskIndex];
      } else {
        // If marking as active, re-add it
        const response = await networkUtils.retryFetch(API_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: task.title })
        });
        
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        // Get the new task from the API
        const newTask = await response.json();
        
        // Remove the old task and add the new one
        allTasks.splice(taskIndex, 1);
        allTasks.push({...newTask, completed: false});
        localStorageService.saveToLocalStorage();
        
        return {...newTask, completed: false};
      }
    } catch (error) {
      console.error("API error:", error);
      // Fallback to local operation
      const taskIndex = allTasks.findIndex((task) => task.id === taskId);
      if (taskIndex > -1) {
        allTasks[taskIndex].completed = !allTasks[taskIndex].completed;
        localStorageService.saveToLocalStorage();
        return allTasks[taskIndex];
      } else {
        throw new Error("Task not found locally");
      }
    }
  },
};

// --- Core Task Logic Functions (now using dataService) ---
async function fetchAndRenderTasks() {
  loadingIndicator.classList.remove("hidden");
  noActiveTasksMessage.classList.add("hidden");
  noCompletedTasksMessage.classList.add("hidden");

  // Clear existing tasks
  activeTaskListContainer.innerHTML = ""; // Clear previous active tasks
  completedTaskListContainer.innerHTML = ""; // Clear previous completed tasks
  // Add back the "no tasks" messages, initially hidden
  activeTaskListContainer.appendChild(noActiveTasksMessage);
  completedTaskListContainer.appendChild(noCompletedTasksMessage);

  try {
    const tasks = await dataService.getTasks();
    
    // Data validation check
    if (!Array.isArray(tasks)) {
      throw new Error("Invalid data format: Expected an array of tasks");
    }
    
    // Check each task has required properties
    const validTasks = tasks.filter(task => {
      const isValid = task && typeof task.id !== 'undefined' && typeof task.title === 'string';
      if (!isValid) {
        console.warn('Invalid task data:', task);
      }
      return isValid;
    });
    
    renderTasks(validTasks);
    
    // Update API status indicator
    networkUtils.updateApiStatusIndicator();
  } catch (error) {
    console.error("Error fetching tasks:", error);
    showMessage(`Failed to load tasks: ${error.message}. Using local data.`, "error");
    noActiveTasksMessage.classList.remove("hidden"); // Show appropriate message on error
    noCompletedTasksMessage.classList.remove("hidden");
  } finally {
    loadingIndicator.classList.add("hidden");
  }
}

async function handleAddTask(title) {
  try {
    await dataService.addTask(title);
    showMessage(`Mission "${title}" added to active roster!`, "success");
    fetchAndRenderTasks();
  } catch (error) {
    console.error("Error adding task:", error);
    showMessage(`Error: ${error.message}`, "error");
  }
}

async function handleToggleTaskStatus(taskId, taskTitle) {
  try {
    const updatedTask = await dataService.toggleTaskStatus(taskId);
    const message = updatedTask.completed
      ? `Mission "${taskTitle}" accomplished!`
      : `Mission "${taskTitle}" reactivated!`;
    showMessage(message, "success");

    const taskElement = document.getElementById(`task-${taskId}`);
    if (taskElement) {
      taskElement.classList.add("task-item-exit", "task-item-exit-active");
      taskElement.addEventListener("transitionend", fetchAndRenderTasks, {
        once: true,
      });
    } else {
      fetchAndRenderTasks();
    }
  } catch (error) {
    console.error("Error toggling task status:", error);
    showMessage(`Error: ${error.message}`, "error");
  }
}

// --- UI Rendering Functions ---
function renderTasks(tasks) {
  activeTaskListContainer.innerHTML = ""; // Clear previous active tasks
  completedTaskListContainer.innerHTML = ""; // Clear previous completed tasks
  // Add back the "no tasks" messages, initially hidden
  activeTaskListContainer.appendChild(noActiveTasksMessage);
  completedTaskListContainer.appendChild(noCompletedTasksMessage);

  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  if (activeTasks.length === 0) {
    noActiveTasksMessage.classList.remove("hidden");
  } else {
    noActiveTasksMessage.classList.add("hidden");
    activeTasks.forEach((task) => {
      const taskElement = createTaskElement(task);
      activeTaskListContainer.appendChild(taskElement);
      requestAnimationFrame(() => {
        taskElement.classList.add("task-item-enter-active");
      });
    });
  }

  if (completedTasks.length === 0) {
    noCompletedTasksMessage.classList.remove("hidden");
  } else {
    noCompletedTasksMessage.classList.add("hidden");
    completedTasks.forEach((task) => {
      const taskElement = createTaskElement(task);
      completedTaskListContainer.appendChild(taskElement);
      requestAnimationFrame(() => {
        // Apply animation for newly completed tasks too
        taskElement.classList.add("task-item-enter-active");
      });
    });
  }
}

function createTaskElement(task) {
  if (!task || task.id === undefined || task.title === undefined) {
    console.error("Invalid task data:", task);
    return document.createElement('div'); // Return empty div to prevent errors
  }

  const div = document.createElement("div");
  div.id = `task-${task.id}`;
  let baseClasses =
    "task-item flex items-center justify-between bg-slate-700 p-3 rounded-lg shadow hover:shadow-md transition-all duration-300 task-item-enter";
  if (task.completed) {
    baseClasses += " completed-task";
  }
  div.className = baseClasses;

  const span = document.createElement("span");
  span.textContent = task.title;
  span.className = "text-gray-100 flex-grow truncate pr-2";
  div.appendChild(span);

  const actionButton = document.createElement("button");
  if (task.completed) {
    actionButton.innerHTML = '<i class="fas fa-undo"></i>';
    actionButton.className =
      "text-yellow-400 hover:text-yellow-300 text-xl transition-colors duration-300 p-2 rounded-full hover:bg-slate-600 flex-shrink-0";
    actionButton.title = "Mark as active";
  } else {
    actionButton.innerHTML = '<i class="fas fa-check-circle"></i>';
    actionButton.className =
      "text-green-400 hover:text-green-300 text-xl transition-colors duration-300 p-2 rounded-full hover:bg-slate-600 flex-shrink-0";
    actionButton.title = "Mark as done";
  }
  actionButton.onclick = () => handleToggleTaskStatus(task.id, task.title);
  div.appendChild(actionButton);

  return div;
}

function showMessage(message, type = "info") {
  messageArea.textContent = message;
  if (type === "error") {
    messageArea.className =
      "mt-6 text-center text-sm text-red-400 p-2 bg-red-900 bg-opacity-50 rounded-md transition-all duration-300";
  } else if (type === "success") {
    messageArea.className =
      "mt-6 text-center text-sm text-green-400 p-2 bg-green-900 bg-opacity-50 rounded-md transition-all duration-300";
  } else {
    messageArea.className =
      "mt-6 text-center text-sm text-slate-400 transition-all duration-300";
  }
  setTimeout(() => {
    messageArea.textContent = "";
    messageArea.className = "mt-6 text-center text-sm";
  }, 4000);
}

// Initialize DOM references after the document is loaded
function initializeApp() {
  addTaskForm = document.getElementById("addTaskForm");
  taskTitleInput = document.getElementById("taskTitle");
  activeTaskListContainer = document.getElementById("activeTaskListContainer");
  completedTaskListContainer = document.getElementById(
    "completedTaskListContainer"
  );
  noActiveTasksMessage = document.getElementById("noActiveTasksMessage");
  noCompletedTasksMessage = document.getElementById("noCompletedTasksMessage");
  loadingIndicator = document.getElementById("loadingIndicator");
  messageArea = document.getElementById("messageArea");

  document.getElementById("currentYear").textContent = new Date().getFullYear();

  // --- Event Listeners ---
  addTaskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = taskTitleInput.value.trim();
    if (title) {
      handleAddTask(title);
      taskTitleInput.value = "";
    } else {
      showMessage("Task title cannot be empty.", "error");
    }
  });

  // Online/offline event handlers
  window.addEventListener('online', () => {
    showMessage("Connection restored. Syncing data...", "info");
    dataSyncService.syncLocalToAPI()
      .then(success => {
        if (success) {
          showMessage("Data synchronized successfully!", "success");
          fetchAndRenderTasks(); // Refresh with latest data
        }
      });
    networkUtils.updateApiStatusIndicator();
  });
  
  window.addEventListener('offline', () => {
    showMessage("You are offline. Changes will be saved locally.", "info");
    networkUtils.updateApiStatusIndicator();
  });

  // Load initial tasks
  if (!localStorageService.loadFromLocalStorage()) {
    fetchAndRenderTasks();
  } else {
    renderTasks(allTasks);
    // Try to sync with API if we're online
    if (networkUtils.isOnline()) {
      dataSyncService.syncLocalToAPI()
        .then(success => {
          if (success) {
            fetchAndRenderTasks();
          }
        });
    }
  }

  // Update API status indicator
  networkUtils.updateApiStatusIndicator();
}

// Initialize app when DOM is fully loaded
document.addEventListener("DOMContentLoaded", initializeApp);
