const ready = function () {
  waitUntilServiceWorkerActiveThenFetch();
  //  Global variables that handle data from the dbs
  let transactions = [];
  let myChart;
  let testDB;

  //  Assign HTML elements to variables
  const nameEl = document.querySelector("#t-name");
  const amountEl = document.querySelector("#t-amount");
  const errorEl = document.querySelector(".form .error");

  //  Click listeners for the Add Funds and Subtract Funds buttons.
  document.querySelector("#add-btn").onclick = function () {
    sendTransaction(true);
  };

  document.querySelector("#sub-btn").onclick = function () {
    sendTransaction(false);
  };

  //  Only allow numerics in amount field
  const amountInputCharsAllowed = /[0-9\/]+/;
  amountEl.addEventListener("keypress", (event) => {
    if (!amountInputCharsAllowed.test(event.key)) {
      event.preventDefault();
    }
  });

  //  Listener triggers when the network changes from offline to online.
  //  Any records that were saved into the indexedDB while offline are
  //  retrieved and posted to the online mongoDB.  Then the indexedDB
  //  records are deleted.
  window.addEventListener("online", async (event) => {
    console.log("You are now connected to the network.");
    console.log(
      "Updating online MongoDB with transactions saved offline in IndexedDB"
    );
    const indexedRecords = await getIndexedRecords();
    fetch("/api/transaction/bulk", {
      method: "POST",
      body: JSON.stringify(indexedRecords),
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
    })
      .then(async (response) => {
        console.log("Offline entries uploaded to online MongoDB");
        await deleteIndexedRecords();
      })
      .catch((error) => {
        console.log(error);
      });
  });

  //  Listener triggers when the network becomes disconnected
  window.addEventListener("offline", (event) => {
    console.log("You are now disconnected from the network.");
  });

  //  Create an indexedDB request
  const testDBRequest = indexedDB.open("testDB", 1);

  // The onupgradeneeded event is triggered upon creation of a database by the open call.
  testDBRequest.onupgradeneeded = (event) => {
    // console.log("onupgradeneeded event", event);
    testDB = event.target.result;
    //  Here the schema is set up.
    const transactionStore = testDB.createObjectStore("transaction", {
      keyPath: "date",
    });
  };

  //  Once the request object resolves the onsuccess is fired and
  //  The result is assigned to testDB.  Console logs provide info
  testDBRequest.onsuccess = (event) => {
    // console.log("onsuccess event", event);
    testDB = event.target.result;
    // console.log("testDB", testDB);
    // console.log("testDBRequest", testDBRequest);
  };

  //  Error handling
  testDBRequest.onerror = (error) => {
    console.log("There was an error ", error);
  };

  //  This function solves the problem of the service-worker
  //  not being ready in time to cache the first fetch
  function waitUntilServiceWorkerActiveThenFetch() {
    if (navigator.serviceWorker.controller === null) {
      console.log("Service worker not active yet... delaying initial fetch.");
      setTimeout(waitUntilServiceWorkerActiveThenFetch, 50);
      return;
    } else {
      console.log("Service worker is active... beginning initial fetch.");
      initialFetchAndPopulate();
    }
  }

  //  Function gets data from the dbs and populates the chart with the data
  function initialFetchAndPopulate() {
    fetch("/api/transaction/fetchAll")
      .then((response) => {
        return response.json();
      })
      .then(async (data) => {
        // save db data on global variable
        transactions = data;
        //  Get any data in the indexedDB and add it to the transactions array
        const indexedRecords = await getIndexedRecords();
        transactions = [...transactions, ...indexedRecords].sort((a, b) => {
          return a.date < b.date ? 1 : -1;
        });
        //  Populate function-calls.  These functions use the global transactions variable
        populateTotal();
        populateTable();
        populateChart();
      });
  }

  //  This function gets data from the indexedDB through a Promise.
  //  Designed to be 'await'-able
  function getIndexedRecords() {
    return new Promise(function (resolve) {
      // set up a transaction
      testDB = testDBRequest.result;
      const dbGetTransaction = testDB.transaction(["transaction"], "readwrite");
      const transactionStore = dbGetTransaction.objectStore("transaction");
      const getRequest = transactionStore.getAll();
      getRequest.onsuccess = () => {
        // console.log("getRequest.result", getRequest.result);
        return resolve(getRequest.result);
      };
    });
  }

  //  This function deletes data from the indexedDB through a Promise.
  //  Designed to be 'await'-able.
  function deleteIndexedRecords() {
    return new Promise(function (resolve) {
      const dbDeleteTransaction = testDB.transaction(
        ["transaction"],
        "readwrite"
      );
      const transactionStore = dbDeleteTransaction.objectStore("transaction");
      const deleteRequest = transactionStore.clear();
      deleteRequest.onsuccess = () => {
        // console.log("IndexedDB entries:", deleteRequest.result);
        return resolve(deleteRequest.result);
      };
    });
  }

  //  Function saves transaction to the indexedDB
  function saveRecord(transaction) {
    const dbSave = testDB.transaction(["transaction"], "readwrite");
    const transactionStore = dbSave.objectStore("transaction");
    const addRequest = transactionStore.add({
      name: transaction.name,
      value: transaction.value,
      date: transaction.date,
    });
    // clear form
    nameEl.value = "";
    amountEl.value = "";
    console.log("Currently offline... transaction saved to indexedDB", transaction);

  }

  //  Populate functions render data to the HTML
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

  //  Function gets info from the client inputs and creates a transaction.
  //  Then the transaction is saved to a database: indexedDB if offline, mongoDB if online.
  //  Then the new data is rendered to HTML
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

    if (navigator.onLine) {
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
          console.log("There was an error when trying to POST", err);
          // clear form
          nameEl.value = "";
          amountEl.value = "";
        });
    } else {
      saveRecord(transaction);
    }
  }
};

window.onload = ready;
