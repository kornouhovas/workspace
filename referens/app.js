const columns = ["backlog", "todo", "progress", "review", "done"];

let tasks = [
  {
    id: "task-1",
    title: "UI toggle for event blocks.",
    description:
      "can we have an alt here where it shows 3 blocks, just the blocks with clean spacing",
    priority: "medium",
    assignee: "GJ",
    author: "Glenn Jones",
    age: "2 days ago",
    label: "Cuebox",
    labelColor: "blue",
    column: "backlog",
  },
  {
    id: "task-2",
    title: "Page loading clarification needed.",
    description: "can you please clarify which pages will load once we click to Notifications and For Owners?",
    priority: "low",
    assignee: "LV",
    author: "Leandro Varanda",
    age: "5 days ago",
    label: "Rev",
    labelColor: "orange",
    column: "backlog",
  },
  {
    id: "task-3",
    title: "Update Ticket Designs in Mock.",
    description: "could you please update the ticket designs across this mock to match the new ticket cutline?",
    priority: "high",
    assignee: "BM",
    author: "Brantley Mathis",
    age: "20 hours ago",
    label: "Mast",
    labelColor: "lavender",
    column: "todo",
  },
  {
    id: "task-4",
    title: "Revert to Pop Over Version",
    description: "We talked to the engs, can we revert back to the pop over version from before?",
    priority: "medium",
    assignee: "DT",
    author: "Dream Tucker",
    age: "2 days ago",
    label: "Cuebox",
    labelColor: "blue",
    column: "todo",
  },
  {
    id: "task-5",
    title: "Polish designs and reach out to devs",
    description: "Need a final pass before we send this flow to implementation.",
    priority: "low",
    assignee: "ED",
    author: "Ellis Drake",
    age: "1 day ago",
    label: "Dabble",
    labelColor: "violet",
    column: "todo",
  },
  {
    id: "task-6",
    title: "Remote user approvals/comments",
    description: "Add a lightweight comment handoff for remote approvers.",
    priority: "high",
    assignee: "GO",
    author: "Gideon Ochoa",
    age: "3 days ago",
    label: "Giraffe",
    labelColor: "red",
    column: "todo",
  },
  {
    id: "task-7",
    title: "Include lien waiver questionnaire statement.",
    description: "The questionnaire/sworn statement for this lien waiver should be shown on here somehow",
    priority: "high",
    assignee: "IE",
    author: "Ivan Erickson",
    age: "5 hours ago",
    label: "Bluejay",
    labelColor: "royal",
    column: "progress",
  },
  {
    id: "task-8",
    title: "Button Styling Concerns",
    description: "I don't love the styling of this button",
    priority: "medium",
    assignee: "TB",
    author: "Tori Bates",
    age: "2 days ago",
    label: "Mast",
    labelColor: "lavender",
    column: "progress",
  },
  {
    id: "task-9",
    title: "Add Search Bar.",
    description: "Wee need to add a search bar here in case this is a permalink",
    priority: "high",
    assignee: "SD",
    author: "Sabrina Deleon",
    age: "4 days ago",
    label: "Rev",
    labelColor: "orange",
    column: "review",
  },
  {
    id: "task-10",
    title: "Update Material Editor Info.",
    description: "Need to update the info on the material editor page",
    priority: "medium",
    assignee: "EO",
    author: "Ellis Ochoa",
    age: "7 days ago",
    label: "Wayland",
    labelColor: "coral",
    column: "review",
  },
  {
    id: "task-11",
    title: "Add Membership Renewal Button.",
    description: "add a button for renewal for membership / flex pass?",
    priority: "low",
    assignee: "GJ",
    author: "Glenn Jones",
    age: "2 days ago",
    label: "Cuebox",
    labelColor: "blue",
    column: "review",
  },
  {
    id: "task-12",
    title: "Feedback labels clean up.",
    description: "Shiprec screen names need simpler labels and cleaner flow.",
    priority: "low",
    assignee: "EO",
    author: "Ellis Ochoa",
    age: "7 days ago",
    label: "Wayland",
    labelColor: "coral",
    column: "done",
  },
];

const priorityLabels = {
  high: "High",
  medium: "Med",
  low: "Low",
};

const board = document.querySelector(".kanban-board");
const searchInput = document.querySelector("#searchInput");
const totalTasks = document.querySelector("#totalTasks");
const compactToggle = document.querySelector("#compactToggle");
const dialog = document.querySelector("#taskDialog");
const newCardButton = document.querySelector("#newCardButton");
const createTaskButton = document.querySelector("#createTaskButton");
const taskTitle = document.querySelector("#taskTitle");
const taskDescription = document.querySelector("#taskDescription");
const taskColumn = document.querySelector("#taskColumn");
const taskPriority = document.querySelector("#taskPriority");

let activePriority = "all";
let draggedTaskId = null;

function createTaskCard(task) {
  const card = document.createElement("article");
  card.className = "task-card";
  card.draggable = true;
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;

  const approveButton =
    task.column === "review"
      ? `<button class="approve-button" type="button" aria-label="Approve ${escapeHtml(task.title)}">Approve</button>`
      : "";

  card.innerHTML = `
    <div class="card-age">${escapeHtml(task.age)}</div>
    <h3>${escapeHtml(task.title)}</h3>
    <div class="comment-box">
      <div class="comment-avatar">${escapeHtml(task.assignee)}</div>
      <div>
        <strong>${escapeHtml(task.author)}</strong>
        <p>${escapeHtml(task.description)}</p>
        <span>${escapeHtml(task.age)}</span>
      </div>
    </div>
    <div class="card-meta">
      <span class="mini-avatar">${escapeHtml(task.assignee.slice(0, 1))}</span>
      <span class="project-tag ${task.labelColor}">${escapeHtml(task.label)}</span>
      <span class="priority ${task.priority}">${priorityLabels[task.priority]}</span>
    </div>
    ${approveButton}
  `;

  card.addEventListener("dragstart", () => {
    draggedTaskId = task.id;
    card.classList.add("dragging");
  });

  card.addEventListener("dragend", () => {
    draggedTaskId = null;
    card.classList.remove("dragging");
    document.querySelectorAll(".column").forEach((column) => column.classList.remove("drop-target"));
  });

  return card;
}

function renderBoard() {
  columns.forEach((columnId) => {
    const list = document.querySelector(`[data-list="${columnId}"]`);
    list.replaceChildren();

    tasks
      .filter((task) => task.column === columnId)
      .forEach((task) => list.append(createTaskCard(task)));
  });

  applyFilters();
  updateCounts();
}

function updateCounts() {
  totalTasks.textContent = String(tasks.length);
  columns.forEach((columnId) => {
    const count = tasks.filter((task) => task.column === columnId).length;
    document.querySelector(`[data-column="${columnId}"] .count`).textContent = String(count);
  });
}

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();

  document.querySelectorAll(".task-card").forEach((card) => {
    const task = tasks.find((item) => item.id === card.dataset.id);
    const matchesPriority = activePriority === "all" || task.priority === activePriority;
    const searchable =
      `${task.title} ${task.description} ${task.assignee} ${task.author} ${task.label}`.toLowerCase();
    const matchesSearch = searchable.includes(query);
    card.classList.toggle("hidden", !matchesPriority || !matchesSearch);
  });
}

function addTask() {
  const title = taskTitle.value.trim();
  if (!title) {
    taskTitle.focus();
    return;
  }

  tasks = [
    ...tasks,
    {
      id: `task-${Date.now()}`,
      title,
      description: taskDescription.value.trim() || "Need a quick pass before this moves forward.",
      priority: taskPriority.value,
      assignee: "AS",
      author: "Alek Sanders",
      age: "just now",
      label: "Internal",
      labelColor: "royal",
      column: taskColumn.value,
    },
  ];

  taskTitle.value = "";
  taskDescription.value = "";
  taskPriority.value = "medium";
  taskColumn.value = "backlog";
  dialog.close();
  renderBoard();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll(".card-list").forEach((list) => {
  list.addEventListener("dragover", (event) => {
    event.preventDefault();
    list.closest(".column").classList.add("drop-target");
  });

  list.addEventListener("dragleave", () => {
    list.closest(".column").classList.remove("drop-target");
  });

  list.addEventListener("drop", (event) => {
    event.preventDefault();
    const columnId = list.dataset.list;
    tasks = tasks.map((task) => (task.id === draggedTaskId ? { ...task, column: columnId } : task));
    list.closest(".column").classList.remove("drop-target");
    renderBoard();
  });
});

document.querySelectorAll(".segment").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segment").forEach((segment) => segment.classList.remove("active"));
    button.classList.add("active");
    activePriority = button.dataset.priority;
    applyFilters();
  });
});

searchInput.addEventListener("input", applyFilters);

compactToggle.addEventListener("click", () => {
  const isCompact = board.classList.toggle("compact");
  compactToggle.setAttribute("aria-pressed", String(isCompact));
});

newCardButton.addEventListener("click", () => {
  dialog.showModal();
  taskTitle.focus();
});

createTaskButton.addEventListener("click", (event) => {
  event.preventDefault();
  addTask();
});

renderBoard();
