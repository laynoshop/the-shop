
    await slateRef.collection("games").doc(eventId).set({
      eventId,
      homeName,
      awayName,
      // store as Firestore timestamp
      startTime: startDate && !isNaN(startDate.getTime()) ? startDate : null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return slateId;
}

async function gpAdminPublishSlate(db, leagueKey, dateYYYYMMDD, uid) {
  const slateId = slateIdFor(leagueKey, dateYYYYMMDD);
  await db.collection("pickSlates").doc(slateId).set({
    published: true,
    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
    publishedBy: uid
  }, { merge: true });
}
