const callback = function () {
  //  Creating a second testDB to try and redo the indexedDB the right way and avoid the errors
  //  I am currently getting with the request db

  //  Here the variable for the actual db is initialized
  var testDB;
  //  Here the request is made to open an indexedDB
  //  I believe this assigns a request object to testDBRequest
  const testDBRequest = indexedDB.open("testDB", 1);
  //  Once the request object resolves?? the onsuccess is fired and
  //  The result is assigned to testDB.  Console logs provide info
  testDBRequest.onsuccess = async (event) => {
    testDB = await getDB(event);
    function getDB(event) {
      return new Promise((resolve) => {
        console.log("onsuccess event", event);
        console.log(testDBRequest.result);
        return resolve(event.target.result);
      });
    }
  };
  // The onupgradeneeded event is triggered upon creation of a database by the open call.
  testDBRequest.onupgradeneeded = (event) => {
    console.log("onupgradeneeded event", event);
    //  I am not exactly certain if this line is needed since testDB was assigned on line 13.
    testDB = event.target.result;
    //  Here the schema is set up.
    const transactionStore = testDB.createObjectStore("transaction", {
      keyPath: "date",
    });
    //  An index is created for date, allowing search by date, which is used later to sort the entries
    transactionStore.createIndex("date", "date");
  };

  //  Error handling
  testDBRequest.onerror = (error) => {
    console.log("There was an error ", error);
  };

  //  Now I want to try and use the new testDB instead of the
  //  first one, and see if I can avoid errors.
  const nameEl = document.querySelector("#t-name");
  const amountEl = document.querySelector("#t-amount");
  const errorEl = document.querySelector(".form .error");

  //  Only allow numerics in amount field
  const amountInputCharsAllowed = /[0-9\/]+/;
  amountEl.addEventListener("keypress", (event) => {
    if (!amountInputCharsAllowed.test(event.key)) {
      event.preventDefault();
    }
  });

  window.addEventListener("online", async (event) => {
    console.log("You are now connected to the network.");
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
        console.log(response);
        await deleteIndexedRecords();
      })
      .catch((error) => {
        console.log(error);
      });
  });

  window.addEventListener("offline", (event) => {
    console.log("You are now disconnected from the network.");
  });

  //Simulating goign online and offline with button
  let onlineBtn = document.getElementById("online");
  onlineBtn.addEventListener("click", async (event) => {
    console.log("You are now connected to the network.");
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
        console.log(response);
        await deleteIndexedRecords();
      })
      .catch((error) => {
        console.log(error);
      });
  });

  let transactions = [];
  let myChart;

  fetch("/api/transaction/fetchAll")
    .then((response) => {
      console.log("fetching on looad");
      return response.json();
    })
    .then(async (data) => {
      console.log("inside fetchAll");
      // save db data on global variable
      transactions = data;
      //  Get any data in the indexedDB and add it to the transactions array
      const indexedRecords = await getIndexedRecords();
      console.log(indexedRecords, "IndexedDBRecords");
      console.log(transactions), "transactions";
      transactions = [...transactions, ...indexedRecords].sort((a, b) => {
        return a.date < b.date ? 1 : -1;
      });
      console.log("indexedDB entry pushed to data");
      console.log(transactions, "transactions");
      console.log("Just before populating ");
      populateTotal();
      populateTable();
      populateChart();
    });

  function getIndexedRecords() {
    return new Promise(function (resolve) {
      // db = request.result;
      // const dbChange = db.transaction(["transaction"], "readwrite");
      // set up a transaction
      console.log(testDB);
      const dbGetTransaction = testDB.transaction(["transaction"], "readwrite");
      //  Assign the objectStore that was created on line 23 ( i think)
      const transactionStore = dbGetTransaction.objectStore("transaction");
      const getRequest = transactionStore.getAll();
      getRequest.onsuccess = () => {
        console.log("getRequest.result", getRequest.result);
        return resolve(getRequest.result);
      };
      // dbGetTransaction.oncomplete((event) => {
      //   console.log("Get Transaction oncomplete event", event);
      // })
    });
  }

  function deleteIndexedRecords() {
    return new Promise(function (resolve) {
      console.log("inside deleteIndexedRecords");
      // db = request.result;
      // const dbDelete = db.transaction(["transaction"], "readwrite");
      const dbDeleteTransaction = testDB.transaction(
        ["transaction"],
        "readwrite"
      );
      // const transactionStore = dbDelete.objectStore("transaction");
      const transactionStore = dbDeleteTransaction.objectStore("transaction");
      const deleteRequest = transactionStore.clear();
      // dbDeleteTransaction.oncomplete((event) => {
      //   console.log("transaction oncomplete event", event);
      // });
      deleteRequest.onsuccess = () => {
        console.log(deleteRequest.result);
        return resolve(deleteRequest.result);
      };
    });
  }

  function saveRecord(transaction) {
    //  Lets use the new testDB
    // db = request.result;

    const dbSave = testDB.transaction(["transaction"], "readwrite");
    const transactionStore = dbSave.objectStore("transaction");
    const addRequest = transactionStore.add({
      name: transaction.name,
      value: transaction.value,
      date: transaction.date,
    });
    // dbSave.oncomplete((event) => {
    //   console.log("Addrequest oncomplete event", event);
    // });
    console.log(transaction, "Transaction saved to indexedDB");
  }

  function populateTotal() {
    // reduce transaction amounts to a single total value
    console.log(transactions);
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
        console.log("fetch failed, so save in indexed db");
        saveRecord(transaction);

        // clear form
        nameEl.value = "";
        amountEl.value = "";
      });
  }

  document.querySelector("#add-btn").onclick = function () {
    sendTransaction(true);
  };

  document.querySelector("#sub-btn").onclick = function () {
    sendTransaction(false);
  };
};

if (
  document.readyState === "complete" ||
  (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  console.log("callback");
  callback();
} else {
  document.addEventListener("DOMContentLoaded", callback);
}
