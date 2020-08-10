const callback = function() {
  const nameEl = document.querySelector("#t-name");
  const amountEl = document.querySelector("#t-amount");
  const errorEl = document.querySelector(".form .error");

  //  Only allow numerics in amount field
  const amountInputCharsAllowed = /[0-9\/]+/;
  amountEl.addEventListener("keypress", event => {
    if (!amountInputCharsAllowed.test(event.key)) {
      event.preventDefault();
    }
  });

  // We request a database instance.
  const request = indexedDB.open("transactions", 1);

  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    const objectStore = db.createObjectStore("transaction", { keyPath: "date"});
    objectStore.createIndex("name", "name");
    objectStore.createIndex("value", "value");
    objectStore.createIndex("date", "date");
  };

  let transactions = [];
  let myChart;

  fetch("/api/transaction")
    .then((response) => {
      return response.json();
    })
    .then((data) => {

      // save db data on global variable
      transactions = data;
      populateTotal();
      populateTable();
      populateChart();
    });

  function populateTotal() {
    // reduce transaction amounts to a single total value
    let total = transactions.reduce((total, t) => {
      return total + parseInt(t.value);
    }, 0);

    let totalEl = document.querySelector("#total");
    totalEl.textContent = total;
  }

  function populateTable() {
    let tbody = document.querySelector("#tbody");
    tbody.innerHTML = "";

    transactions.forEach((transaction) => {
      // create and populate a table row
      let tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

      tbody.appendChild(tr);
    });
  }

  function populateChart() {
    // copy array and reverse it
    let reversed = transactions.slice().reverse();
    let sum = 0;

    // create date labels for chart
    let labels = reversed.map((t) => {

      let date = new Date(t.date);
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    });

    // create incremental values for chart
    let data = reversed.map((t) => {
      sum += parseInt(t.value);
      return sum;
    });

    // remove old chart if it exists
    if (myChart) {
      myChart.destroy();
    }

    let ctx = document.getElementById("myChart").getContext("2d");

    myChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data, //  Find more specific word for this?
          },
        ],
      },
    });
  }

  function sendTransaction(isAdding) {

    // validate form
    if (nameEl.value === "" || amountEl.value === "") {
      errorEl.textContent = "Missing Information";
      return;
    } else {
      errorEl.textContent = "";
    }

    // create record
    let transaction = {
      name: nameEl.value,
      value: parseInt(amountEl.value),
      date: new Date().toISOString(),
    };
    // if subtracting funds, convert amount to negative number
    if (!isAdding) {
      transaction.value *= -1;
    }

    // add to beginning of current array of data
    transactions.unshift(transaction);
    
    // re-run logic to populate ui with new record
    populateChart();
    populateTable();
    populateTotal();
    
    // also send to server
    fetch("/api/transaction", {
      method: "POST",
      body: JSON.stringify(transaction),
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        if (data.errors) {
          errorEl.textContent = "Missing Information";
        } else {
          // clear form
          nameEl.value = "";
          amountEl.value = "";
        }
      })
      .catch((err) => {
        // fetch failed, so save in indexed db
        console.log("fetch failed, so save in indexed db")
        saveRecord(transaction);

        // clear form
        nameEl.value = "";
        amountEl.value = "";
      });
  }

  function saveRecord(transaction) {
      const db = request.result;
      const dbChange = db.transaction(["transaction"], "readwrite");
      const transactionStore = dbChange.objectStore("transaction");
      transactionStore.add({ name: transaction.name, value: transaction.value, date: transaction.date });
    console.log(transaction, "Transaction saved to indexedDB");
  }

  document.querySelector("#add-btn").onclick = function () {
    sendTransaction(true);
  };

  document.querySelector("#sub-btn").onclick = function () {
    sendTransaction(false);
  };
}


if (
    document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  console.log("callback")
  callback();
} else {
  document.addEventListener("DOMContentLoaded", callback);
}
