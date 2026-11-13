(function () {
  "use strict";

  const DATA_KEY = "academic-portal-demo-v1";
  const STUDENT_SESSION_KEY = "academic-portal-student";
  const DEMO_ASSIGNMENT = {
    id: "demo-assignment",
    title: "التكليف التجريبي الأول",
    maxGrade: 10,
    dueDate: ""
  };
  const $ = (id) => document.getElementById(id);

  function emptyState() {
    return { profiles: [], assignments: [DEMO_ASSIGNMENT], submissions: [] };
  }

  function loadState() {
    const saved = localStorage.getItem(DATA_KEY);
    if (!saved) return emptyState();
    const data = JSON.parse(saved);
    if (!data || !Array.isArray(data.profiles) || !Array.isArray(data.assignments) || !Array.isArray(data.submissions)) {
      throw new Error("تعذر قراءة بيانات النسخة التجريبية. لا يمكن استعادة البيانات المحفوظة.");
    }
    return data;
  }

  let state;
  try {
    state = loadState();
  } catch (error) {
    document.addEventListener("DOMContentLoaded", function () {
      const notice = $("notice");
      if (notice) {
        notice.textContent = error.message;
        notice.classList.add("is-error");
        notice.hidden = false;
      }
    });
    return;
  }

  function saveState() {
    localStorage.setItem(DATA_KEY, JSON.stringify(state));
  }

  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + "-" + window.crypto.randomUUID();
    }
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function makeCode() {
    const values = new Uint32Array(1);
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(values);
      return String(100000 + (values[0] % 900000));
    }
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  function makeCell(text, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = text == null || text === "" ? "—" : String(text);
    return cell;
  }

  function makeLink(url, label) {
    const safe = safeUrl(url);
    if (!safe) {
      const unavailable = document.createElement("span");
      unavailable.textContent = "رابط غير صالح";
      return unavailable;
    }
    const link = document.createElement("a");
    link.href = safe;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  function addEmptyRow(body, columns, message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columns;
    cell.className = "empty-row";
    cell.textContent = message;
    row.appendChild(cell);
    body.replaceChildren(row);
  }

  function notify(message, isError) {
    const notice = $("notice");
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("is-error", Boolean(isError));
    notice.hidden = false;
  }

  function attempt(action, successMessage) {
    try {
      action();
      if (successMessage) notify(successMessage, false);
      return true;
    } catch (error) {
      notify(error.message || "تعذر حفظ التغيير في هذا المتصفح.", true);
      return false;
    }
  }

  function setTabs(buttons, panels, activeId) {
    buttons.forEach(function (button) {
      const active = button.id === activeId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.id !== buttons.find(function (button) {
        return button.id === activeId;
      }).getAttribute("aria-controls");
    });
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  }

  function initStudentPage() {
    const authView = $("authView");
    const studentView = $("studentView");
    const loginTab = $("loginTab");
    const registerTab = $("registerTab");
    const loginPanel = $("loginPanel");
    const registerPanel = $("registerPanel");

    function currentStudent() {
      const id = sessionStorage.getItem(STUDENT_SESSION_KEY);
      const student = state.profiles.find(function (profile) { return profile.id === id; }) || null;
      if (id && !student) sessionStorage.removeItem(STUDENT_SESSION_KEY);
      return student;
    }

    function render() {
      const student = currentStudent();
      authView.hidden = Boolean(student);
      studentView.hidden = !student;
      $("logoutButton").hidden = !student;
      if (!student) return;
      $("studentGreeting").textContent = "أهلاً، " + student.name;
      $("profileName").textContent = student.name;
      $("profileId").textContent = student.id;
      $("profileDepartment").textContent = student.department;
      renderAssignmentOptions();
      renderHistory(student);
    }

    function renderAssignmentOptions() {
      const select = $("assignmentSelect");
      const assignments = state.assignments.slice().sort(function (a, b) { return a.title.localeCompare(b.title, "ar"); });
      select.replaceChildren();
      assignments.forEach(function (assignment) {
        const option = document.createElement("option");
        option.value = assignment.id;
        option.textContent = assignment.title + " — الدرجة القصوى: " + assignment.maxGrade +
          (assignment.dueDate ? " — الموعد: " + assignment.dueDate : "");
        select.appendChild(option);
      });
      $("assignmentCount").textContent = String(assignments.length);
      $("submitButton").disabled = assignments.length === 0;
      if (!assignments.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "لا توجد تكليفات متاحة حالياً";
        select.appendChild(option);
      }
    }

    function renderHistory(student) {
      const submissions = state.submissions.filter(function (submission) { return submission.studentId === student.id; });
      const history = $("studentHistory");
      $("submittedCount").textContent = String(submissions.length);
      $("gradedCount").textContent = String(submissions.filter(function (submission) { return submission.status === "graded"; }).length);
      if (!submissions.length) {
        addEmptyRow(history, 6, "لم تسلّم أي تكليف بعد.");
        return;
      }
      history.replaceChildren();
      submissions.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).forEach(function (submission) {
        const assignment = state.assignments.find(function (item) { return item.id === submission.assignmentId; });
        const row = document.createElement("tr");
        row.appendChild(makeCell((assignment ? assignment.title : submission.assignmentTitle) + " — " + submission.title));
        row.appendChild(makeCell(formatDate(submission.createdAt)));
        const linkCell = makeCell("");
        linkCell.replaceChildren(makeLink(submission.url, "فتح الرابط"));
        row.appendChild(linkCell);
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");
        badge.className = "status-pill" + (submission.status === "graded" ? " is-graded" : "");
        badge.textContent = submission.status === "graded" ? "تم التقييم" : "بانتظار التقييم";
        statusCell.appendChild(badge);
        row.appendChild(statusCell);
        row.appendChild(makeCell(submission.grade == null ? "—" : submission.grade + " / " + submission.maxGrade));
        row.appendChild(makeCell(submission.feedback));
        history.appendChild(row);
      });
    }

    loginTab.addEventListener("click", function () {
      setTabs([loginTab, registerTab], [loginPanel, registerPanel], "loginTab");
    });
    registerTab.addEventListener("click", function () {
      $("createdCode").hidden = true;
      setTabs([loginTab, registerTab], [loginPanel, registerPanel], "registerTab");
    });

    loginPanel.addEventListener("submit", function (event) {
      event.preventDefault();
      const id = $("loginId").value.trim();
      const code = $("loginCode").value.trim();
      const profile = state.profiles.find(function (item) { return item.id === id; });
      if (!profile || profile.code !== code) {
        notify("الرقم الجامعي أو رمز الدخول غير صحيح.", true);
        return;
      }
      sessionStorage.setItem(STUDENT_SESSION_KEY, profile.id);
      loginPanel.reset();
      render();
      notify("تم تسجيل الدخول إلى النسخة التجريبية.", false);
    });

    registerPanel.addEventListener("submit", function (event) {
      event.preventDefault();
      const name = $("registerName").value.trim();
      const id = $("registerId").value.trim();
      const department = $("registerDepartment").value.trim();
      if (!name || !id || !department) {
        notify("يرجى استكمال بيانات الملف.", true);
        return;
      }
      if (state.profiles.some(function (profile) { return profile.id === id; })) {
        notify("هذا الرقم الجامعي مسجل بالفعل في هذا المتصفح.", true);
        return;
      }
      const profile = { id: id, name: name, department: department, code: makeCode() };
      if (!attempt(function () {
        state.profiles.push(profile);
        saveState();
      })) {
        state.profiles = state.profiles.filter(function (item) { return item.id !== id; });
        return;
      }
      registerPanel.reset();
      const codeBox = $("createdCode");
      codeBox.replaceChildren();
      codeBox.appendChild(document.createTextNode("تم إنشاء الملف. رمز الدخول التجريبي (يظهر هنا فقط): "));
      const code = document.createElement("strong");
      code.textContent = profile.code;
      codeBox.appendChild(code);
      codeBox.hidden = false;
      notify("احتفظ بالرمز؛ لا توجد خدمة لاستعادته إذا فُقد.", false);
    });

    $("submissionForm").addEventListener("submit", function (event) {
      event.preventDefault();
      const student = currentStudent();
      if (!student) {
        notify("انتهت جلسة الطالب. سجّل الدخول مجدداً.", true);
        render();
        return;
      }
      const assignment = state.assignments.find(function (item) { return item.id === $("assignmentSelect").value; });
      const url = safeUrl($("submissionUrl").value.trim());
      if (!assignment) {
        notify("اختر تكليفاً متاحاً قبل التسليم.", true);
        return;
      }
      if (!url) {
        notify("يجب أن يبدأ رابط التسليم بـ HTTPS.", true);
        return;
      }
      const submission = {
        id: makeId("submission"),
        studentId: student.id,
        studentName: student.name,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        maxGrade: assignment.maxGrade,
        title: $("submissionTitle").value.trim(),
        url: url,
        notes: $("submissionNotes").value.trim(),
        createdAt: new Date().toISOString(),
        status: "pending",
        grade: null,
        feedback: ""
      };
      if (!attempt(function () {
        state.submissions.push(submission);
        saveState();
      }, "تم حفظ التسليم على هذا المتصفح.")) {
        state.submissions = state.submissions.filter(function (item) { return item.id !== submission.id; });
        return;
      }
      $("submissionForm").reset();
      render();
    });

    $("logoutButton").addEventListener("click", function () {
      sessionStorage.removeItem(STUDENT_SESSION_KEY);
      render();
      notify("تم تسجيل الخروج.", false);
    });

    render();
    return render;
  }

  function initAdminPage() {
    const tabs = [$("submissionsTab"), $("assignmentsTab"), $("profilesTab")];
    const panels = [$("submissionsPanel"), $("assignmentsPanel"), $("profilesPanel")];

    function renderSubmissions() {
      const body = $("adminSubmissions");
      const query = $("submissionSearch").value.trim().toLocaleLowerCase("ar");
      const submissions = state.submissions.slice().sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); });
      const filtered = submissions.filter(function (item) {
        return (item.studentName + " " + item.studentId).toLocaleLowerCase("ar").includes(query);
      });
      $("totalSubmissions").textContent = String(submissions.length);
      $("gradedSubmissions").textContent = String(submissions.filter(function (item) { return item.status === "graded"; }).length);
      $("pendingSubmissions").textContent = String(submissions.filter(function (item) { return item.status !== "graded"; }).length);
      if (!filtered.length) {
        addEmptyRow(body, 6, submissions.length ? "لا توجد نتائج مطابقة." : "لا توجد تسليمات بعد.");
        return;
      }
      body.replaceChildren();
      filtered.forEach(function (submission) {
        const row = document.createElement("tr");
        const student = document.createElement("td");
        student.textContent = submission.studentName;
        const studentId = document.createElement("span");
        studentId.className = "subtle";
        studentId.textContent = "الرقم الجامعي: " + submission.studentId;
        student.appendChild(studentId);
        row.appendChild(student);
        row.appendChild(makeCell((submission.assignmentTitle || "تكليف") + " — " + submission.title));
        row.appendChild(makeCell(formatDate(submission.createdAt)));
        const linkCell = makeCell("");
        linkCell.replaceChildren(makeLink(submission.url, "فتح التسليم"));
        row.appendChild(linkCell);
        row.appendChild(makeCell(submission.grade == null ? "بانتظار التقييم" : submission.grade + " / " + submission.maxGrade));
        const actionCell = document.createElement("td");
        const reviewButton = document.createElement("button");
        reviewButton.type = "button";
        reviewButton.className = "button button-primary";
        reviewButton.textContent = submission.status === "graded" ? "تعديل التقييم" : "تقييم";
        reviewButton.addEventListener("click", function () { openReview(submission); });
        actionCell.appendChild(reviewButton);
        row.appendChild(actionCell);
        body.appendChild(row);
      });
    }

    function renderAssignments() {
      const list = $("assignmentList");
      list.replaceChildren();
      if (!state.assignments.length) {
        const empty = document.createElement("p");
        empty.className = "helper-text";
        empty.textContent = "لا توجد تكليفات منشورة. أضف تكليفاً ليظهر للطلاب.";
        list.appendChild(empty);
        return;
      }
      state.assignments.forEach(function (assignment) {
        const item = document.createElement("article");
        item.className = "item-card";
        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = assignment.title;
        const meta = document.createElement("small");
        meta.textContent = "الدرجة القصوى: " + assignment.maxGrade +
          (assignment.dueDate ? " — الموعد النهائي: " + assignment.dueDate : "");
        details.append(title, meta);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button button-danger";
        remove.textContent = "حذف";
        remove.addEventListener("click", function () {
          if (!window.confirm("حذف التكليف من القائمة؟ ستبقى التسليمات السابقة محفوظة.")) return;
          const previous = state.assignments;
          state.assignments = previous.filter(function (item) { return item.id !== assignment.id; });
          if (attempt(saveState, "تم حذف التكليف. بقيت التسليمات السابقة محفوظة.")) renderAll();
          else state.assignments = previous;
        });
        item.append(details, remove);
        list.appendChild(item);
      });
    }

    function renderProfiles() {
      const body = $("adminProfiles");
      $("profileCount").textContent = String(state.profiles.length);
      if (!state.profiles.length) {
        addEmptyRow(body, 5, "لا توجد ملفات طلاب مسجلة في هذا المتصفح.");
        return;
      }
      body.replaceChildren();
      state.profiles.forEach(function (profile) {
        const row = document.createElement("tr");
        row.appendChild(makeCell(profile.name));
        row.appendChild(makeCell(profile.id));
        row.appendChild(makeCell(profile.department));
        row.appendChild(makeCell(state.submissions.filter(function (submission) { return submission.studentId === profile.id; }).length));
        const actionCell = document.createElement("td");
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button button-danger";
        remove.textContent = "حذف الملف";
        remove.addEventListener("click", function () {
          if (!window.confirm("حذف ملف الطالب وتسليماته المسجلة على هذا المتصفح؟")) return;
          const oldProfiles = state.profiles;
          const oldSubmissions = state.submissions;
          state.profiles = oldProfiles.filter(function (item) { return item.id !== profile.id; });
          state.submissions = oldSubmissions.filter(function (item) { return item.studentId !== profile.id; });
          if (attempt(saveState, "تم حذف الملف وتسليماته المحلية.")) renderAll();
          else {
            state.profiles = oldProfiles;
            state.submissions = oldSubmissions;
          }
        });
        actionCell.appendChild(remove);
        row.appendChild(actionCell);
        body.appendChild(row);
      });
    }

    function openReview(submission) {
      $("reviewTitle").textContent = "تقييم: " + submission.studentName;
      $("reviewDetails").textContent = (submission.assignmentTitle || "تكليف") + " — " + submission.title +
        " — الدرجة القصوى: " + submission.maxGrade +
        (submission.notes ? " — ملاحظة الطالب: " + submission.notes : "");
      const link = $("reviewLink");
      const safe = safeUrl(submission.url);
      link.hidden = !safe;
      if (safe) link.href = safe;
      $("reviewSubmissionId").value = submission.id;
      $("reviewGrade").max = String(submission.maxGrade);
      $("reviewGrade").value = submission.grade == null ? "" : String(submission.grade);
      $("reviewFeedback").value = submission.feedback || "";
      $("reviewDialog").showModal();
    }

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () { setTabs(tabs, panels, tab.id); });
    });
    $("submissionSearch").addEventListener("input", renderSubmissions);
    $("assignmentForm").addEventListener("submit", function (event) {
      event.preventDefault();
      const title = $("assignmentTitle").value.trim();
      const maxGrade = Number($("assignmentMaxGrade").value);
      const dueDate = $("assignmentDueDate").value;
      if (!title || !Number.isFinite(maxGrade) || maxGrade <= 0) {
        notify("أدخل عنواناً ودرجة قصوى أكبر من صفر.", true);
        return;
      }
      const assignment = { id: makeId("assignment"), title: title, maxGrade: maxGrade, dueDate: dueDate };
      if (!attempt(function () {
        state.assignments.push(assignment);
        saveState();
      }, "تمت إضافة التكليف. سيظهر في قائمة الطالب على هذا المتصفح.")) {
        state.assignments = state.assignments.filter(function (item) { return item.id !== assignment.id; });
        return;
      }
      $("assignmentForm").reset();
      $("assignmentMaxGrade").value = "10";
      renderAll();
    });
    $("reviewForm").addEventListener("submit", function (event) {
      event.preventDefault();
      const submission = state.submissions.find(function (item) { return item.id === $("reviewSubmissionId").value; });
      const grade = Number($("reviewGrade").value);
      if (!submission || !Number.isFinite(grade) || grade < 0 || grade > submission.maxGrade) {
        notify("أدخل درجة بين صفر والدرجة القصوى (" + (submission ? submission.maxGrade : "—") + ").", true);
        return;
      }
      const old = { grade: submission.grade, feedback: submission.feedback, status: submission.status };
      submission.grade = grade;
      submission.feedback = $("reviewFeedback").value.trim();
      submission.status = "graded";
      if (!attempt(saveState, "تم حفظ التقييم محلياً.")) {
        Object.assign(submission, old);
        return;
      }
      $("reviewDialog").close();
      renderAll();
    });
    $("closeReview").addEventListener("click", function () { $("reviewDialog").close(); });
    $("reviewDialog").addEventListener("click", function (event) {
      if (event.target === $("reviewDialog")) $("reviewDialog").close();
    });
    $("exportButton").addEventListener("click", function () {
      const quote = function (value) {
        let text = String(value == null ? "" : value);
        if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      };
      const rows = [
        ["اسم الطالب", "الرقم الجامعي", "التكليف", "عنوان التسليم", "التاريخ", "الرابط", "الدرجة", "ملاحظات الطالب", "ملاحظات المحاضر"],
        ...state.submissions.map(function (item) {
          return [item.studentName, item.studentId, item.assignmentTitle, item.title, formatDate(item.createdAt),
            item.url, item.grade, item.notes, item.feedback];
        })
      ];
      const csv = "\uFEFF" + rows.map(function (row) { return row.map(quote).join(","); }).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "تسليمات-الطلاب.csv";
      link.click();
      URL.revokeObjectURL(url);
    });

    function renderAll() {
      renderSubmissions();
      renderAssignments();
      renderProfiles();
    }

    renderAll();
    return renderAll;
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      let render;
      if (document.body.dataset.page === "student") render = initStudentPage();
      if (document.body.dataset.page === "admin") render = initAdminPage();
      window.addEventListener("storage", function (event) {
        if (event.key !== DATA_KEY) return;
        try {
          state = loadState();
          render();
        } catch (error) {
          notify(error.message || "تعذر تحديث البيانات.", true);
        }
      });
    } catch (error) {
      notify(error.message || "تعذر تشغيل البوابة التجريبية.", true);
    }
  });
}());
