
// Activate auto complete for path input box
function activateAutoComplete() {
        $("#inputPath").keypress(function(event) {
                if(event.keyCode == 47 || event.keyCode == 92){
                        if(event.keyCode == 47) {
                                fileSeperator = '/';
                        } else {
                                fileSeperator = '\\';
                        }

                        $.ajax({
                                type: "GET",
                                url: "getFiles",
                                data: {term: $('#inputPath').val() + fileSeperator},
                                cache: false
                        }).done(function(msg) {
                                result = $.parseJSON(msg);
                                $("#inputPath").autocomplete({
                                        source: result.files
                                });
                                $("#inputPath").autocomplete("search", $('#inputPath').val());
                        }).fail(function(jqXHR, textStatus){
                        });
                } else if(event.keyCode == 13){
                        event.preventDefault();
                        url = '/#/repository?path=' + encodeURI($('#inputPath').val());
                        window.location = url;
                }
        });
}

