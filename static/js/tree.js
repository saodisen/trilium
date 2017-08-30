const keybindings = {
    "insert": function(node) {
        let parentKey = (node.getParent() === null || node.getParent().key === "root_1") ? "root" : node.getParent().key;

        createNote(node, parentKey, 'after');
    },
    "ctrl+insert": function(node) {
        createNote(node, node.key, 'into');
    },
    "del": function(node) {
        if (confirm('Are you sure you want to delete note "' + node.title + '"?')) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key,
                type: 'DELETE',
                success: function() {
                    if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                        node.getParent().folder = false;
                        node.getParent().renderTitle();
                    }

                    delete globalNoteNames[node.key];

                    // remove from recent notes
                    recentNotes = recentNotes.filter(note => note !== node.key);

                    let next = node.getNextSibling();
                    if (!next) {
                        next = node.getParent();
                    }

                    node.remove();

                    // activate next element after this one is deleted so we don't lose focus
                    next.setActive();
                }
            });
        }
    },
    "shift+up": function(node) {
        if (node.getPrevSibling() !== null) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key + '/moveBefore/' + node.getPrevSibling().key,
                type: 'PUT',
                contentType: "application/json",
                success: function() {
                    node.moveTo(node.getPrevSibling(), 'before');
                }
            });
        }
    },
    "shift+down": function(node) {
        if (node.getNextSibling() !== null) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key + '/moveAfter/' + node.getNextSibling().key,
                type: 'PUT',
                contentType: "application/json",
                success: function() {
                    node.moveTo(node.getNextSibling(), 'after');
                }
            });
        }
    },
    "shift+left": function(node) {
        if (node.getParent() !== null) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key + '/moveAfter/' + node.getParent().key,
                type: 'PUT',
                contentType: "application/json",
                success: function() {
                    if (node.getParent() !== null && node.getParent().getChildren().length <= 1) {
                        node.getParent().folder = false;
                        node.getParent().renderTitle();
                    }

                    node.moveTo(node.getParent(), 'after');
                }
            });
        }
    },
    "shift+right": function(node) {
        let prevSibling = node.getPrevSibling();

        if (prevSibling !== null) {
            $.ajax({
                url: baseUrl + 'notes/' + node.key + '/moveTo/' + prevSibling.key,
                type: 'PUT',
                contentType: "application/json",
                success: function(result) {
                    node.moveTo(prevSibling);

                    prevSibling.setExpanded(true);

                    prevSibling.folder = true;
                    prevSibling.renderTitle();
                }
            });
        }
    },
    "return": function(node) {
        // doesn't work :-/
        $('#noteDetail').summernote('focus');
    }
};

const globalNoteNames = {};

$(function(){
    $.get(baseUrl + 'tree').then(resp => {
        const notes = resp.notes;
        let startNoteId = resp.start_note_id;

        if (document.location.hash) {
            startNoteId = document.location.hash.substr(1); // strip initial #
        }

        function copyTitle(notes) {
            for (let note of notes) {
                globalNoteNames[note.note_id] = note.note_title;

                note.title = note.note_title;

                if (note.is_clone) {
                    note.title += " (clone)";
                }

                note.key = note.note_id;
                note.expanded = note.is_expanded;

                if (note.children && note.children.length > 0) {
                    copyTitle(note.children);
                }
            }
        }

        copyTitle(notes);

        function setExpanded(note_id, is_expanded) {
            expanded_num = is_expanded ? 1 : 0;

            $.ajax({
                url: baseUrl + 'notes/' + note_id + '/expanded/' + expanded_num,
                type: 'PUT',
                contentType: "application/json",
                success: function(result) {}
            });
        }

        $("#tree").fancytree({
            autoScroll: true,
            extensions: ["hotkeys", "filter"],
            source: notes,
            activate: function(event, data){
                const node = data.node.data;

                saveNoteIfChanged(() => loadNote(node.note_id));
            },
            expand: function(event, data) {
                setExpanded(data.node.key, true);
            },
            collapse: function(event, data) {
                setExpanded(data.node.key, false);
            },
            init: function(event, data) {
                if (startNoteId) {
                    data.tree.activateKey(startNoteId);
                }
            },
            hotkeys: {
                keydown: keybindings
            },
            filter: {
                autoApply: true,   // Re-apply last filter if lazy data is loaded
                autoExpand: true, // Expand all branches that contain matches while filtered
                counter: false,     // Show a badge with number of matching child nodes near parent icons
                fuzzy: false,      // Match single characters in order, e.g. 'fb' will match 'FooBar'
                hideExpandedCounter: true,  // Hide counter badge if parent is expanded
                hideExpanders: false,       // Hide expanders if all child nodes are hidden by filter
                highlight: true,   // Highlight matches by wrapping inside <mark> tags
                leavesOnly: false, // Match end nodes only
                nodata: true,      // Display a 'no data' status node if result is empty
                mode: "hide"       // Grayout unmatched nodes (pass "hide" to remove unmatched node instead)
            }
        });
    });
});

$("input[name=search]").keyup(function (e) {
    let match = $(this).val();

    if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(match) === "") {
        $("button#btnResetSearch").click();
        return;
    }

    // Pass a string to perform case insensitive matching
    let tree = $("#tree").fancytree("getTree");
    tree.filterBranches(match);
}).focus();

$("button#btnResetSearch").click(function () {
    $("input[name=search]").val("");

    let tree = $("#tree").fancytree("getTree");
    tree.clearFilter();
});

function collapseTree() {
    $("#tree").fancytree("getRootNode").visit(function(node){
        node.setExpanded(false);
    });
}

$(document).bind('keydown', 'alt+c', collapseTree);