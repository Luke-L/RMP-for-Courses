// ==UserScript==
// @name         RMP4C
// @description  Adds RMP data to course searches, may not work with other than tcc.
// @version      0.4
// @author       Luke-L
// @match        https://selfservice.tccd.edu/Student/Courses/Search*
// @match        https://selfservice.tccd.edu/Student/Student/Courses/Search*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=greasyfork.org
// @HomepageURL  https://github.com/Luke-L/RMP-for-Courses
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    "use strict";

    let schoolName, longID, shortID, querySelector;

    // Define School configurations
    const schoolConfigs = {
        "selfservice.tccd.edu": {
            name: "Tarrant County College",
            longID: "U2Nob29sLTE1NTc=",
            shortID: "1557",
            getQuerySelector: () => {
                if (Ellucian && Ellucian.Course && Ellucian.Course.SearchResult && Ellucian.Course.SearchResult.jsonData && Ellucian.Course.SearchResult.jsonData.searchResultsView) {
                    let searchResultsView = Ellucian.Course.SearchResult.jsonData.searchResultsView;
                    if (searchResultsView === "CatalogListing") {
                        return 'div[data-bind="foreach: TermsAndSections"] > ul > li > table > tbody > tr:first-child > td:last-child >div > span:first-child';
                    } else if (searchResultsView === "SectionListing") {
                        return 'td.esg-table-body__td--section-table[data-role="Faculty"] span[data-bind*="faculty.FacultyName"]';
                    }
                }
                return null; // Default or fallback querySelector, if needed
            }
        },
        "arcs-prd.utshare.utsystem.edu": {
            name: "University of Texas at Arlington",
            longID: "U2Nob29sLTEzNDM=",
            shortID: "1343",
            querySelector: "span[id^='MTG_INSTR$']"
        }
        // Add more schools with their configurations here
    };

    // Determine the current school based on the URL
    for (let urlPart in schoolConfigs) {
        if (window.location.href.includes(urlPart)) {
            const config = schoolConfigs[urlPart];
            schoolName = config.name;
            longID = config.longID;
            shortID = config.shortID;
            querySelector = config.getQuerySelector();
            break;
        }
    }

    if (!querySelector) {
        console.error("Configuration not found for this URL.");
        return; // Exit the script if the configuration is not found
    }

    const CHECK_INTERVAL = 10000;
    const WAIT_FOR_COURSE_STABLE = 5000;

    async function clickOpen() {
        let btns = document.querySelectorAll('button[id^="collapsible-view-available-sections-for-"]');
        for (let btn of btns) {
            console.log(btn);
            btn.click();
        }
    }

    async function addLink() {
        let querySelector = currentSchoolConfig.querySelector;

        // TCCD Section/Catalog search page
        if (window.location.href.includes("selfservice.tccd.edu")) {
            if (Ellucian && Ellucian.Course && Ellucian.Course.SearchResult && Ellucian.Course.SearchResult.jsonData && Ellucian.Course.SearchResult.jsonData.searchResultsView) {
                let searchResultsView = Ellucian.Course.SearchResult.jsonData.searchResultsView;
                console.log("Search Results View: ", searchResultsView);

                if (searchResultsView === "CatalogListing") {
                    // Query selector for 'CatalogListing' view
                    querySelector = 'div[data-bind="foreach: TermsAndSections"] > ul > li > table > tbody > tr:first-child > td:last-child >div > span:first-child';
                }
                else if (searchResultsView === "SectionListing") {
                    // Query selector for 'SectionListing' view
                    querySelector = 'td.esg-table-body__td--section-table[data-role="Faculty"] span[data-bind*="faculty.FacultyName"]';
                }
            } else {
                console.error("Ellucian.Course.SearchResult.jsonData object or searchResultsView property not found");
                return; // Exit the function if the necessary data isn't available
            }
        } else {
            console.error("Not a TCC page");
            return; // Exit the function if the necessary data isn't available
        }

        // Selects all span elements based on the querySelector defined earlier
        let spans = document.querySelectorAll(querySelector);

        // Iterates over each span element found
        for (let span of spans) {
            let ratingNotExist = span.getElementsByTagName("A").length == 0;
            console.log("ratingNotExist", ratingNotExist);

            // Proceeds if no rating link is found
            if (ratingNotExist) {
                // Retrieves and trims the professor's name from the span's text content
                let professorName = span.textContent.trim();
                console.log(professorName, professorName.length);

                if (professorName.length > 0) {
                    getRatingByName(professorName).then((info) => {
                        if (typeof info != "undefined") {
                            // Creates a new anchor element for the rating
                            let eleA = document.createElement("A");
                            eleA.setAttribute("href", "#");

                            // Sets onclick function to open the rating page in a new tab
                            let onclickFun = `window.open("https://www.ratemyprofessors.com/professor?tid=${info.legacyId}", "_blank")`;
                            eleA.setAttribute("onclick", onclickFun);

                            // Sets the text content of the anchor element to show the rating and difficulty
                            eleA.textContent = `  Rating:${info.avgRating}(${info.numRatings}) Difficulty:${info.avgDifficulty}`;

                            span.insertAdjacentElement("beforeend", eleA);
                        } else {
                            let eleA = document.createElement("A");
                            // Creates a URL for searching the professor on RateMyProfessors
                            let searchURL = `https://www.ratemyprofessors.com/search/professors/1557?q=${encodeURIComponent(professorName)}`;
                            eleA.setAttribute("href", searchURL);
                            eleA.setAttribute("target", "_blank");
                            eleA.textContent = "Rating Not Found - Search";
                            span.insertAdjacentElement("beforeend", eleA);
                        }
                    }).catch(() => {
                        // Error handling for when the getRatingByName function fails (e.g., network error)
                        let eleA = document.createElement("A");
                        let searchURL = `https://www.ratemyprofessors.com/search/professors/1557?q=${encodeURIComponent(professorName)}`;
                        eleA.setAttribute("href", searchURL);
                        eleA.setAttribute("target", "_blank");
                        eleA.textContent = "Rating Not Found - Search";
                        span.insertAdjacentElement("beforeend", eleA);
                    });
                } else {
                    // Handles the case where the span does not contain a professor's name
                    let eleA = document.createElement("A");
                    span.insertAdjacentElement("beforeend", eleA);
                }
            }
        }
    }
    async function getRatingByName(professorName) {
        let singleResult = await new Promise((resolve) => {
            const url = "https://www.ratemyprofessors.com/graphql";
            GM_xmlhttpRequest({
                url,
                headers: {
                    accept: "*/*",
                    "accept-language": "en-US,en;q=0.9",
                    authorization: "Basic dGVzdDp0ZXN0",
                    "cache-control": "no-cache",
                    "content-type": "application/json",
                    pragma: "no-cache",
                },
                data: `{\"query\":\"query NewSearchTeachersQuery(\\n  $query: TeacherSearchQuery!\\n) {\\n  newSearch {\\n    teachers(query: $query) {\\n      didFallback\\n      edges {\\n        cursor\\n        node {\\n          id\\n          legacyId\\n          firstName\\n          lastName\\n          school {\\n            name\\n            id\\n          }\\n          department\\n        }\\n      }\\n    }\\n  }\\n}\\n\",\"variables\":{\"query\":{\"text\":\"${professorName}\",\"schoolID\":\"U2Nob29sLTE1NTc=\"}}}`,
                method: "POST",
                onload: (data) => {
                    if (data.status == 200) {
                        resolve(JSON.parse(data.responseText));
                    }
                },
            });
        })
            .then((json) => {
                console.log(json);
                return new Promise((resolve, reject) => {
                    let edgesNode = json.data.newSearch.teachers.edges;
                    if (edgesNode.length == 0) {
                        reject(new Exception("no record found"));
                    }
                    let baseNode = edgesNode[0].node;
                    let id = baseNode.id;
                    console.log(baseNode.firstName, baseNode.lastName, id);
                    resolve(id);
                });
            })
            .then((professorID) => {
                console.log(professorID);
                const url = "https://www.ratemyprofessors.com/graphql";
                return new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        url,
                        headers: {
                            accept: "*/*",
                            "accept-language": "en-US,en;q=0.9",
                            authorization: "Basic dGVzdDp0ZXN0",
                            "cache-control": "no-cache",
                            "content-type": "application/json",
                            pragma: "no-cache",
                        },
                        data: `{\"query\":\"query TeacherRatingsPageQuery(\\n  $id: ID!\\n) {\\n  node(id: $id) {\\n    __typename\\n    ... on Teacher {\\n      id\\n      legacyId\\n      firstName\\n      lastName\\n      school {\\n        legacyId\\n        name\\n        id\\n      }\\n      lockStatus\\n      ...StickyHeader_teacher\\n      ...RatingDistributionWrapper_teacher\\n      ...TeacherMetaInfo_teacher\\n      ...TeacherInfo_teacher\\n      ...SimilarProfessors_teacher\\n      ...TeacherRatingTabs_teacher\\n    }\\n    id\\n  }\\n}\\n\\nfragment StickyHeader_teacher on Teacher {\\n  ...HeaderDescription_teacher\\n  ...HeaderRateButton_teacher\\n}\\n\\nfragment RatingDistributionWrapper_teacher on Teacher {\\n  ...NoRatingsArea_teacher\\n  ratingsDistribution {\\n    total\\n    ...RatingDistributionChart_ratingsDistribution\\n  }\\n}\\n\\nfragment TeacherMetaInfo_teacher on Teacher {\\n  legacyId\\n  firstName\\n  lastName\\n  department\\n  school {\\n    name\\n    city\\n    state\\n    id\\n  }\\n}\\n\\nfragment TeacherInfo_teacher on Teacher {\\n  id\\n  lastName\\n  numRatings\\n  ...RatingValue_teacher\\n  ...NameTitle_teacher\\n  ...TeacherTags_teacher\\n  ...NameLink_teacher\\n  ...TeacherFeedback_teacher\\n  ...RateTeacherLink_teacher\\n}\\n\\nfragment SimilarProfessors_teacher on Teacher {\\n  department\\n  relatedTeachers {\\n    legacyId\\n    ...SimilarProfessorListItem_teacher\\n    id\\n  }\\n}\\n\\nfragment TeacherRatingTabs_teacher on Teacher {\\n  numRatings\\n  courseCodes {\\n    courseName\\n    courseCount\\n  }\\n  ...RatingsList_teacher\\n  ...RatingsFilter_teacher\\n}\\n\\nfragment RatingsList_teacher on Teacher {\\n  id\\n  legacyId\\n  lastName\\n  numRatings\\n  school {\\n    id\\n    legacyId\\n    name\\n    city\\n    state\\n    avgRating\\n    numRatings\\n  }\\n  ...Rating_teacher\\n  ...NoRatingsArea_teacher\\n  ratings(first: 20) {\\n    edges {\\n      cursor\\n      node {\\n        ...Rating_rating\\n        id\\n        __typename\\n      }\\n    }\\n    pageInfo {\\n      hasNextPage\\n      endCursor\\n    }\\n  }\\n}\\n\\nfragment RatingsFilter_teacher on Teacher {\\n  courseCodes {\\n    courseCount\\n    courseName\\n  }\\n}\\n\\nfragment Rating_teacher on Teacher {\\n  ...RatingFooter_teacher\\n  ...RatingSuperHeader_teacher\\n  ...ProfessorNoteSection_teacher\\n}\\n\\nfragment NoRatingsArea_teacher on Teacher {\\n  lastName\\n  ...RateTeacherLink_teacher\\n}\\n\\nfragment Rating_rating on Rating {\\n  comment\\n  flagStatus\\n  createdByUser\\n  teacherNote {\\n    id\\n  }\\n  ...RatingHeader_rating\\n  ...RatingSuperHeader_rating\\n  ...RatingValues_rating\\n  ...CourseMeta_rating\\n  ...RatingTags_rating\\n  ...RatingFooter_rating\\n  ...ProfessorNoteSection_rating\\n}\\n\\nfragment RatingHeader_rating on Rating {\\n  date\\n  class\\n  helpfulRating\\n  clarityRating\\n  isForOnlineClass\\n}\\n\\nfragment RatingSuperHeader_rating on Rating {\\n  legacyId\\n}\\n\\nfragment RatingValues_rating on Rating {\\n  helpfulRating\\n  clarityRating\\n  difficultyRating\\n}\\n\\nfragment CourseMeta_rating on Rating {\\n  attendanceMandatory\\n  wouldTakeAgain\\n  grade\\n  textbookUse\\n  isForOnlineClass\\n  isForCredit\\n}\\n\\nfragment RatingTags_rating on Rating {\\n  ratingTags\\n}\\n\\nfragment RatingFooter_rating on Rating {\\n  id\\n  comment\\n  adminReviewedAt\\n  flagStatus\\n  legacyId\\n  thumbsUpTotal\\n  thumbsDownTotal\\n  thumbs {\\n    userId\\n    thumbsUp\\n    thumbsDown\\n    id\\n  }\\n  teacherNote {\\n    id\\n  }\\n}\\n\\nfragment ProfessorNoteSection_rating on Rating {\\n  teacherNote {\\n    ...ProfessorNote_note\\n    id\\n  }\\n  ...ProfessorNoteEditor_rating\\n}\\n\\nfragment ProfessorNote_note on TeacherNotes {\\n  comment\\n  ...ProfessorNoteHeader_note\\n  ...ProfessorNoteFooter_note\\n}\\n\\nfragment ProfessorNoteEditor_rating on Rating {\\n  id\\n  legacyId\\n  class\\n  teacherNote {\\n    id\\n    teacherId\\n    comment\\n  }\\n}\\n\\nfragment ProfessorNoteHeader_note on TeacherNotes {\\n  createdAt\\n  updatedAt\\n}\\n\\nfragment ProfessorNoteFooter_note on TeacherNotes {\\n  legacyId\\n  flagStatus\\n}\\n\\nfragment RateTeacherLink_teacher on Teacher {\\n  legacyId\\n  numRatings\\n  lockStatus\\n}\\n\\nfragment RatingFooter_teacher on Teacher {\\n  id\\n  legacyId\\n  lockStatus\\n  isProfCurrentUser\\n}\\n\\nfragment RatingSuperHeader_teacher on Teacher {\\n  firstName\\n  lastName\\n  legacyId\\n  school {\\n    name\\n    id\\n  }\\n}\\n\\nfragment ProfessorNoteSection_teacher on Teacher {\\n  ...ProfessorNote_teacher\\n  ...ProfessorNoteEditor_teacher\\n}\\n\\nfragment ProfessorNote_teacher on Teacher {\\n  ...ProfessorNoteHeader_teacher\\n  ...ProfessorNoteFooter_teacher\\n}\\n\\nfragment ProfessorNoteEditor_teacher on Teacher {\\n  id\\n}\\n\\nfragment ProfessorNoteHeader_teacher on Teacher {\\n  lastName\\n}\\n\\nfragment ProfessorNoteFooter_teacher on Teacher {\\n  legacyId\\n  isProfCurrentUser\\n}\\n\\nfragment SimilarProfessorListItem_teacher on RelatedTeacher {\\n  legacyId\\n  firstName\\n  lastName\\n  avgRating\\n}\\n\\nfragment RatingValue_teacher on Teacher {\\n  avgRating\\n  numRatings\\n  ...NumRatingsLink_teacher\\n}\\n\\nfragment NameTitle_teacher on Teacher {\\n  id\\n  firstName\\n  lastName\\n  department\\n  school {\\n    legacyId\\n    name\\n    id\\n  }\\n  ...TeacherDepartment_teacher\\n  ...TeacherBookmark_teacher\\n}\\n\\nfragment TeacherTags_teacher on Teacher {\\n  lastName\\n  teacherRatingTags {\\n    legacyId\\n    tagCount\\n    tagName\\n    id\\n  }\\n}\\n\\nfragment NameLink_teacher on Teacher {\\n  isProfCurrentUser\\n  id\\n  legacyId\\n  lastName\\n}\\n\\nfragment TeacherFeedback_teacher on Teacher {\\n  numRatings\\n  avgDifficulty\\n  wouldTakeAgainPercent\\n}\\n\\nfragment TeacherDepartment_teacher on Teacher {\\n  department\\n  school {\\n    legacyId\\n    name\\n    id\\n  }\\n}\\n\\nfragment TeacherBookmark_teacher on Teacher {\\n  id\\n  isSaved\\n}\\n\\nfragment NumRatingsLink_teacher on Teacher {\\n  numRatings\\n  ...RateTeacherLink_teacher\\n}\\n\\nfragment RatingDistributionChart_ratingsDistribution on ratingsDistribution {\\n  r1\\n  r2\\n  r3\\n  r4\\n  r5\\n}\\n\\nfragment HeaderDescription_teacher on Teacher {\\n  id\\n  firstName\\n  lastName\\n  department\\n  school {\\n    legacyId\\n    name\\n    city\\n    state\\n    id\\n  }\\n  ...TeacherTitles_teacher\\n  ...TeacherBookmark_teacher\\n}\\n\\nfragment HeaderRateButton_teacher on Teacher {\\n  ...RateTeacherLink_teacher\\n}\\n\\nfragment TeacherTitles_teacher on Teacher {\\n  department\\n  school {\\n    legacyId\\n    name\\n    id\\n  }\\n}\\n\",\"variables\":{\"id\":\"${professorID}\"}}`,
                        method: "POST",
                        onload: (data) => {
                            if (data.status == 200) {
                                resolve(JSON.parse(data.responseText));
                            }
                        },
                    });
                });
            })
            .then((json) => {
                console.log(json);
                let avgRating = json.data.node.avgRating;
                let numRatings = json.data.node.numRatings;
                let legacyId = json.data.node.legacyId;
                let avgDifficulty = json.data.node.avgDifficulty;
                console.log(avgRating, legacyId);
                return { avgRating, numRatings, avgDifficulty, legacyId };
            })
            .catch((err) => {
                // console.error(err);
                console.log("record not found");
            });

        console.log("singleResult : ", singleResult);
        return singleResult;
    }

    let pageType = "";
    setInterval(() => {
        let unclickedButton = Array.from(document.querySelectorAll('div[data-bind="foreach: TermsAndSections"]')).some((v) => {
            return v.textContent.trim() == "";
        });
        console.log(unclickedButton);
        if (unclickedButton) {
            clickOpen();
        }

        let linkTimer = setTimeout(() => {
            addLink();
            clearTimeout(linkTimer);
            linkTimer = null;
        }, WAIT_FOR_COURSE_STABLE);
    }, CHECK_INTERVAL);
})();
