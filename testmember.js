document.addEventListener("DOMContentLoaded", function (event) {
    $(document).ready(function () {
        var gobeliDailyReceiveSheet = 1;
        var tempSplit = 1;

        const d = new Date();
        let hour = d.getHours();
        let day = d.getDay();

        $(document).on("change", ".itemprice", function () {
            var sum = 0;
            $(".itemprice").each(function () {
                sum += +$(this).val();
            });
            $("#itemPrice").val(sum.toFixed(2));
        });

        $("#productweight").on('keyup', function () {
            if (document.getElementById("productweight").value <= 3) {
                document.getElementById("additionalCharge").value = (0).toFixed(2)
            } else {
                document.getElementById('additionalCharge').value = Number((document.getElementById("productweight").value) - 3).toFixed(2)
            }
        });

        $('input[name=products]').change(function () {
            document.getElementById("code").value = '673';
            document.getElementById("code_2").value = '673';
            document.getElementById("code_3").value = '673';
            document.getElementById("name").readOnly = true;
            document.getElementById("house").readOnly = true;
            document.getElementById("kampong").readOnly = true;
            document.getElementById("jalan").readOnly = true;
            document.getElementById("simpang").readOnly = true;
            document.getElementById("district").readOnly = true;
            document.getElementById("postal").readOnly = true;
            document.getElementById("email").readOnly = true;
            document.getElementById("contact_1").readOnly = true;
            document.getElementById("contact_2").readOnly = true;
            document.getElementById("dateofbirth").readOnly = true;
            document.getElementById("icPassportNum").readOnly = true;

            if ($(this).val() == "pharmacymoh") {
                $('#submitBtnfinal').attr('disabled', true);

                $("#paymentonlinegr").fadeIn();
                $("#paymentonlinegb").hide();

                document.getElementById("personaldetailslabel").innerText = "Personal Details (Patient)";
                document.getElementById("personaldetailslabelsum").innerText = "Personal Details (Patient)";

                $("#bruHIMSNumberTemp").fadeIn();
                $("#patientNumberTemp").hide();

                $("#personalsection").fadeIn();
                $("#personalNextBtn").fadeIn();

                $("#sectionone").fadeIn();
                $("#sectiontwo").hide();
                $("#sectionthree").hide();
                $("#sectionfour").hide();

                $("#appointmentDistrictMOH").fadeIn();
                $("#hcAreaMapAddress").fadeIn();
                $("#clinicAddress").fadeIn();

                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#jpmcpjsc").hide();

                $("#sectionmohcharges").fadeIn();
                $("#sectionjpmccharges").hide();
                $("#sectionphccharges").hide();
                $("#sectionlocalcharges").hide();
                $("#sectiongrpcharges").hide();
                $("#sectioncbslcharges").hide();
                $("#paymentmethodarea").fadeIn();

                document.getElementById('patientNumber').value = document.getElementById('bruHIMSNumberTemp').value;
                document.getElementById('patientNumberTemp').value = '';
                $("#icpassportChoice").hide();
                $('input[name=icpassport]').attr('checked', false);
                $("#icarea").hide();
                document.getElementById('icnumber').value = '';
                $("#passportarea").hide();
                document.getElementById('passport').value = '';
                $('input[name=districtAppointment]').attr('checked', false);
                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";
                $('input[name=jpmcpjsc]').attr('checked', false);

                document.getElementById("grpTrack").value = "";
                document.getElementById("GoRushReceivingCountry").value = '';
                $('input[name=shipmentMethod]').attr('checked', false);
                document.getElementById("ecommerce").value = "";
                document.getElementById("commodities").value = "";
                document.getElementById("currency").value = "";
                document.getElementById("weight").value = "";
                $('input[name=permit]').attr('checked', false);
                $('input[name=itemContains]').attr('checked', false);
                document.getElementById("Item-Description").value = "";
                document.getElementById("Quantity").value = "";
                document.getElementById("Total-Item-Price").value = "";
                document.getElementById("itemPrice").value = "";

                $('input[name=pickupordelivery]').attr('checked', false);
                $("#pickupdatearea").hide();
                document.getElementById("pickupdate").value = "";
                $("#pickupaddressarea").hide();
                document.getElementById("pickupaddress").value = "";
                document.getElementById("productdescription").value = "";
                document.getElementById("producttype").value = "";
                document.getElementById("productweight").value = "";
                document.getElementById("receiverName").value = "";
                document.getElementById("receiverHouse").value = "";
                document.getElementById("receiverKampong").value = "";
                document.getElementById("receiverJalan").value = "";
                document.getElementById("receiverSimpang").value = "";
                $('input[name=receiverDistrict]').attr('checked', false);
                document.getElementById("receiverPostal").value = "";
                document.getElementById("receiverEmail").value = "";
                document.getElementById("receiverContact_1").value = "";

                $('input[name=pickupordeliverycbsl]').attr('checked', false);
                document.getElementById("GB-RS-Track").value = "";
                document.getElementById("GB-RS-Courier").value = "";
                document.getElementById("gbrsItemDescription").value = "";
                document.getElementById("GB-RS-Quantity").value = "";
                document.getElementById("GB-RS-Total-Amount").value = "";
                $("#paymentmethod option[value='Bank Transfer (Baiduri)']").show();
                $("#paymentmethod option[value='Bank Transfer (BIBD)']").hide();
                $("#paymentmethod option[value='Bill Payment (BIBD)']").show();
                $("#paymentnotegr").fadeIn();
                $("#paymentnotegb").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
                $('input[name=jpmcCharges]').attr('checked', false);
                $('input[name=jpmcPayingPatient]').attr('checked', false);
                $('input[name=phcCharges]').attr('checked', false);
                $('input[name=phcPayingPatient]').attr('checked', false);
                $('input[name=localCharges]').attr('checked', false);
                $('input[name=grpCharges]').attr('checked', false);
                $('input[name=cbslCharges]').attr('checked', false);
                document.getElementById("billto").value = "";
                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";

                document.getElementById("patientnumlabel").innerText = "Bru-HIMs Number:*";

                $("#patientNumberTemp").attr("minlength", "");
                $("#patientNumberTemp").attr("maxlength", "");

                document.getElementById("personalNextBtn").focus();
            }

            if ($(this).val() == "pharmacyjpmc") {
                $('#submitBtnfinal').attr('disabled', true);

                $("#paymentonlinegr").fadeIn();
                $("#paymentonlinegb").hide();

                document.getElementById("personaldetailslabel").innerText = "Personal Details (Patient)";
                document.getElementById("personaldetailslabelsum").innerText = "Personal Details (Patient)";
                $("#bruHIMSNumberTemp").hide();
                $("#patientNumberTemp").fadeIn()

                $("#personalsection").fadeIn();
                $("#personalNextBtn").fadeIn();

                $("#sectionone").fadeIn();
                $("#sectiontwo").hide();
                $("#sectionthree").hide();
                $("#sectionfour").hide();

                $("#appointmentDistrictMOH").hide();
                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#jpmcpjsc").fadeIn();

                $("#sectionmohcharges").hide();
                $("#sectionjpmccharges").fadeIn();
                $("#sectionphccharges").hide();
                $("#sectionlocalcharges").hide();
                $("#sectiongrpcharges").hide();
                $("#sectioncbslcharges").hide();
                $("#paymentmethodarea").fadeIn();

                document.getElementById('patientNumber').value = document.getElementById('patientNumberJPMCTemp').value;
                document.getElementById('patientNumberTemp').value = document.getElementById('patientNumberJPMCTemp').value;
                $("#icpassportChoice").hide();
                $('input[name=icpassport]').attr('checked', false);
                $("#icarea").hide();
                document.getElementById('icnumber').value = '';
                $("#passportarea").hide();
                document.getElementById('passport').value = '';
                $('input[name=districtAppointment]').attr('checked', false);
                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";
                $('input[name=jpmcpjsc]').attr('checked', false);

                $('input[name=pickupordeliverygrp]').attr('checked', false);
                document.getElementById("grpTrack").value = "";
                document.getElementById("GoRushReceivingCountry").value = '';
                $('input[name=shipmentMethod]').attr('checked', false);
                document.getElementById("ecommerce").value = "";
                document.getElementById("commodities").value = "";
                document.getElementById("currency").value = "";
                document.getElementById("weight").value = "";
                $('input[name=permit]').attr('checked', false);
                $('input[name=itemContains]').attr('checked', false);
                document.getElementById("Item-Description").value = "";
                document.getElementById("Quantity").value = "";
                document.getElementById("Total-Item-Price").value = "";
                document.getElementById("itemPrice").value = "";

                $('input[name=pickupordelivery]').attr('checked', false);
                $("#pickupdatearea").hide();
                document.getElementById("pickupdate").value = "";
                $("#pickupaddressarea").hide();
                document.getElementById("pickupaddress").value = "";
                document.getElementById("productdescription").value = "";
                document.getElementById("producttype").value = "";
                document.getElementById("productweight").value = "";
                document.getElementById("receiverName").value = "";
                document.getElementById("receiverHouse").value = "";
                document.getElementById("receiverKampong").value = "";
                document.getElementById("receiverJalan").value = "";
                document.getElementById("receiverSimpang").value = "";
                $('input[name=receiverDistrict]').attr('checked', false);
                document.getElementById("receiverPostal").value = "";
                document.getElementById("receiverEmail").value = "";
                document.getElementById("receiverContact_1").value = "";

                $('input[name=pickupordeliverycbsl]').attr('checked', false);
                document.getElementById("GB-RS-Track").value = "";
                document.getElementById("GB-RS-Courier").value = "";
                document.getElementById("gbrsItemDescription").value = "";
                document.getElementById("GB-RS-Quantity").value = "";
                document.getElementById("GB-RS-Total-Amount").value = "";
                $("#paymentmethod option[value='Bank Transfer (Baiduri)']").show();
                $("#paymentmethod option[value='Bank Transfer (BIBD)']").hide();
                $("#paymentmethod option[value='Bill Payment (BIBD)']").show();
                $("#paymentnotegr").fadeIn();
                $("#paymentnotegb").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
                $('input[name=jpmcCharges]').attr('checked', false);
                $('input[name=jpmcPayingPatient]').attr('checked', false);
                $('input[name=phcCharges]').attr('checked', false);
                $('input[name=phcPayingPatient]').attr('checked', false);
                $('input[name=localCharges]').attr('checked', false);
                $('input[name=grpCharges]').attr('checked', false);
                $('input[name=cbslCharges]').attr('checked', false);
                document.getElementById("billto").value = "";
                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";

                document.getElementById("patientnumlabel").innerText = "Patient Number:*";

                $("#patientNumberTemp").attr("minlength", "6");
                $("#patientNumberTemp").attr("maxlength", "8");

                document.getElementById("personalNextBtn").focus();
            }

            if ($(this).val() == "pharmacyphc") {
                $('#submitBtnfinal').attr('disabled', true);

                $("#paymentonlinegr").fadeIn();
                $("#paymentonlinegb").hide();

                document.getElementById("personaldetailslabel").innerText = "Personal Details (Patient)";
                document.getElementById("personaldetailslabelsum").innerText = "Personal Details (Patient)";
                $("#bruHIMSNumberTemp").hide();
                $("#patientNumberTemp").fadeIn();

                $("#personalsection").fadeIn();
                $("#personalNextBtn").fadeIn();

                $("#sectionone").fadeIn();
                $("#sectiontwo").hide();
                $("#sectionthree").hide();
                $("#sectionfour").hide();

                $("#appointmentDistrictMOH").hide();
                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#jpmcpjsc").hide();

                $("#sectionmohcharges").hide();
                $("#sectionjpmccharges").hide();
                $("#sectionphccharges").fadeIn();
                $("#sectionlocalcharges").hide();
                $("#sectiongrpcharges").hide();
                $("#sectioncbslcharges").hide();
                $("#paymentmethodarea").fadeIn();

                document.getElementById('patientNumber').value = document.getElementById('patientNumberPHCTemp').value;
                document.getElementById('patientNumberTemp').value = document.getElementById('patientNumberPHCTemp').value;
                $("#icpassportChoice").hide();
                $('input[name=icpassport]').attr('checked', false);
                $("#icarea").hide();
                document.getElementById('icnumber').value = '';
                $("#passportarea").hide();
                document.getElementById('passport').value = '';
                $('input[name=districtAppointment]').attr('checked', false);
                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";
                $('input[name=jpmcpjsc]').attr('checked', false);

                $('input[name=pickupordeliverygrp]').attr('checked', false);
                document.getElementById("grpTrack").value = "";
                document.getElementById("GoRushReceivingCountry").value = '';
                $('input[name=shipmentMethod]').attr('checked', false);
                document.getElementById("ecommerce").value = "";
                document.getElementById("commodities").value = "";
                document.getElementById("currency").value = "";
                document.getElementById("weight").value = "";
                $('input[name=permit]').attr('checked', false);
                $('input[name=itemContains]').attr('checked', false);
                document.getElementById("Item-Description").value = "";
                document.getElementById("Quantity").value = "";
                document.getElementById("Total-Item-Price").value = "";
                document.getElementById("itemPrice").value = "";

                $('input[name=pickupordelivery]').attr('checked', false);
                $("#pickupdatearea").hide();
                document.getElementById("pickupdate").value = "";
                $("#pickupaddressarea").hide();
                document.getElementById("pickupaddress").value = "";
                document.getElementById("productdescription").value = "";
                document.getElementById("producttype").value = "";
                document.getElementById("productweight").value = "";
                document.getElementById("receiverName").value = "";
                document.getElementById("receiverHouse").value = "";
                document.getElementById("receiverKampong").value = "";
                document.getElementById("receiverJalan").value = "";
                document.getElementById("receiverSimpang").value = "";
                $('input[name=receiverDistrict]').attr('checked', false);
                document.getElementById("receiverPostal").value = "";
                document.getElementById("receiverEmail").value = "";
                document.getElementById("receiverContact_1").value = "";

                $('input[name=pickupordeliverycbsl]').attr('checked', false);
                document.getElementById("GB-RS-Track").value = "";
                document.getElementById("GB-RS-Courier").value = "";
                document.getElementById("gbrsItemDescription").value = "";
                document.getElementById("GB-RS-Quantity").value = "";
                document.getElementById("GB-RS-Total-Amount").value = "";
                $("#paymentmethod option[value='Bank Transfer (Baiduri)']").show();
                $("#paymentmethod option[value='Bank Transfer (BIBD)']").hide();
                $("#paymentmethod option[value='Bill Payment (BIBD)']").show();
                $("#paymentnotegr").fadeIn();
                $("#paymentnotegb").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
                $('input[name=jpmcCharges]').attr('checked', false);
                $('input[name=jpmcPayingPatient]').attr('checked', false);
                $('input[name=phcCharges]').attr('checked', false);
                $('input[name=phcPayingPatient]').attr('checked', false);
                $('input[name=localCharges]').attr('checked', false);
                $('input[name=grpCharges]').attr('checked', false);
                $('input[name=cbslCharges]').attr('checked', false);
                document.getElementById("billto").value = "";
                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";
                document.getElementById("patientnumlabel").innerText = "Patient Number:*";

                $("#patientNumberTemp").attr("minlength", "");
                $("#patientNumberTemp").attr("maxlength", "");

                document.getElementById("personalNextBtn").focus();
            }

            if ($(this).val() == "grp") {
                $('#submitBtnfinal').attr('disabled', true);

                $("#paymentonlinegr").fadeIn();
                $("#paymentonlinegb").hide();

                document.getElementById("personaldetailslabel").innerText = "Personal Details (Buyer)";
                document.getElementById("personaldetailslabelsum").innerText = "Personal Details (Buyer)";
                $("#bruHIMSNumberTemp").hide();
                $("#patientNumberTemp").hide();

                $("#personalsection").fadeIn();
                $("#personalNextBtn").fadeIn();

                $("#sectionone").hide();
                $("#sectiontwo").fadeIn();
                $("#sectionthree").hide();
                $("#sectionfour").hide();

                $("#appointmentDistrictMOH").hide();
                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#jpmcpjsc").hide();

                $("#sectionmohcharges").hide();
                $("#sectionjpmccharges").hide();
                $("#sectionphccharges").hide();
                $("#sectionlocalcharges").hide();
                $("#sectiongrpcharges").fadeIn();
                $("#sectioncbslcharges").hide();
                $("#paymentmethodarea").fadeIn();

                document.getElementById('patientNumber').value = '';
                document.getElementById('patientNumberTemp').value = '';
                $("#icpassportChoice").hide();
                $('input[name=icpassport]').attr('checked', false);
                $("#icarea").hide();
                document.getElementById('icnumber').value = '';
                $("#passportarea").hide();
                document.getElementById('passport').value = '';
                $('input[name=districtAppointment]').attr('checked', false);
                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";
                $('input[name=jpmcpjsc]').attr('checked', false);

                $('input[name=pickupordeliverygrp]').attr('checked', false);
                document.getElementById("grpTrack").value = "";
                document.getElementById("GoRushReceivingCountry").value = '';
                $('input[name=shipmentMethod]').attr('checked', false);
                document.getElementById("ecommerce").value = "";
                document.getElementById("commodities").value = "";
                document.getElementById("currency").value = "";
                document.getElementById("weight").value = "";
                $('input[name=permit]').attr('checked', false);
                $('input[name=itemContains]').attr('checked', false);
                document.getElementById("Item-Description").value = "";
                document.getElementById("Quantity").value = "";
                document.getElementById("Total-Item-Price").value = "";
                document.getElementById("itemPrice").value = "";

                $('input[name=pickupordelivery]').attr('checked', false);
                $("#pickupdatearea").hide();
                document.getElementById("pickupdate").value = "";
                $("#pickupaddressarea").hide();
                document.getElementById("pickupaddress").value = "";
                document.getElementById("productdescription").value = "";
                document.getElementById("producttype").value = "";
                document.getElementById("productweight").value = "";
                document.getElementById("receiverName").value = "";
                document.getElementById("receiverHouse").value = "";
                document.getElementById("receiverKampong").value = "";
                document.getElementById("receiverJalan").value = "";
                document.getElementById("receiverSimpang").value = "";
                $('input[name=receiverDistrict]').attr('checked', false);
                document.getElementById("receiverPostal").value = "";
                document.getElementById("receiverEmail").value = "";
                document.getElementById("receiverContact_1").value = "";

                $('input[name=pickupordeliverycbsl]').attr('checked', false);
                document.getElementById("GB-RS-Track").value = "";
                document.getElementById("GB-RS-Courier").value = "";
                document.getElementById("gbrsItemDescription").value = "";
                document.getElementById("GB-RS-Quantity").value = "";
                document.getElementById("GB-RS-Total-Amount").value = "";
                $("#paymentmethod option[value='Bank Transfer (Baiduri)']").show();
                $("#paymentmethod option[value='Bank Transfer (BIBD)']").hide();
                $("#paymentmethod option[value='Bill Payment (BIBD)']").show();
                $("#paymentnotegr").fadeIn();
                $("#paymentnotegb").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
                $('input[name=jpmcCharges]').attr('checked', false);
                $('input[name=jpmcPayingPatient]').attr('checked', false);
                $('input[name=phcCharges]').attr('checked', false);
                $('input[name=phcPayingPatient]').attr('checked', false);
                $('input[name=localCharges]').attr('checked', false);
                $('input[name=grpCharges]').attr('checked', false);
                $('input[name=cbslCharges]').attr('checked', false);
                document.getElementById("billto").value = "";
                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";

                document.getElementById("personalNextBtn").focus();
            }

            if ($(this).val() == "localdelivery") {
                $('#submitBtnfinal').attr('disabled', true);

                $("#paymentonlinegr").fadeIn();
                $("#paymentonlinegb").hide();

                document.getElementById("personaldetailslabel").innerText = "Personal Details (Sender)";
                document.getElementById("personaldetailslabelsum").innerText = "Personal Details (Sender)";
                $("#bruHIMSNumberTemp").hide();
                $("#patientNumberTemp").hide();

                $("#personalsection").fadeIn();
                $("#personalNextBtn").fadeIn();

                $("#sectionone").hide();
                $("#sectiontwo").hide();
                $("#sectionthree").fadeIn();
                $("#sectionfour").hide();

                $("#appointmentDistrictMOH").hide();
                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#jpmcpjsc").hide();

                $("#sectionmohcharges").hide();
                $("#sectionjpmccharges").hide();
                $("#sectionphccharges").hide();
                $("#sectionlocalcharges").fadeIn();
                $("#sectiongrpcharges").hide();
                $("#sectioncbslcharges").hide();
                $("#paymentmethodarea").fadeIn();

                document.getElementById('patientNumber').value = '';
                document.getElementById('patientNumberTemp').value = '';
                $("#icpassportChoice").hide();
                $('input[name=icpassport]').attr('checked', false);
                $("#icarea").hide();
                document.getElementById('icnumber').value = '';
                $("#passportarea").hide();
                document.getElementById('passport').value = '';
                $('input[name=districtAppointment]').attr('checked', false);
                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";
                $('input[name=jpmcpjsc]').attr('checked', false);

                $('input[name=pickupordeliverygrp]').attr('checked', false);
                document.getElementById("grpTrack").value = "";
                document.getElementById("GoRushReceivingCountry").value = '';
                $('input[name=shipmentMethod]').attr('checked', false);
                document.getElementById("ecommerce").value = "";
                document.getElementById("commodities").value = "";
                document.getElementById("currency").value = "";
                document.getElementById("weight").value = "";
                $('input[name=permit]').attr('checked', false);
                $('input[name=itemContains]').attr('checked', false);
                document.getElementById("Item-Description").value = "";
                document.getElementById("Quantity").value = "";
                document.getElementById("Total-Item-Price").value = "";
                document.getElementById("itemPrice").value = "";

                $('input[name=pickupordelivery]').attr('checked', false);
                $("#pickupdatearea").hide();
                document.getElementById("pickupdate").value = "";
                $("#pickupaddressarea").hide();
                document.getElementById("pickupaddress").value = "";
                document.getElementById("productdescription").value = "";
                document.getElementById("producttype").value = "";
                document.getElementById("productweight").value = "";
                document.getElementById("receiverName").value = "";
                document.getElementById("receiverHouse").value = "";
                document.getElementById("receiverKampong").value = "";
                document.getElementById("receiverJalan").value = "";
                document.getElementById("receiverSimpang").value = "";
                $('input[name=receiverDistrict]').attr('checked', false);
                document.getElementById("receiverPostal").value = "";
                document.getElementById("receiverEmail").value = "";
                document.getElementById("receiverContact_1").value = "";

                $('input[name=pickupordeliverycbsl]').attr('checked', false);
                document.getElementById("GB-RS-Track").value = "";
                document.getElementById("GB-RS-Courier").value = "";
                document.getElementById("gbrsItemDescription").value = "";
                document.getElementById("GB-RS-Quantity").value = "";
                document.getElementById("GB-RS-Total-Amount").value = "";
                $("#paymentmethod option[value='Bank Transfer (Baiduri)']").show();
                $("#paymentmethod option[value='Bank Transfer (BIBD)']").hide();
                $("#paymentmethod option[value='Bill Payment (BIBD)']").show();
                $("#paymentnotegr").fadeIn();
                $("#paymentnotegb").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
                $('input[name=jpmcCharges]').attr('checked', false);
                $('input[name=jpmcPayingPatient]').attr('checked', false);
                $('input[name=phcCharges]').attr('checked', false);
                $('input[name=phcPayingPatient]').attr('checked', false);
                $('input[name=localCharges]').attr('checked', false);
                $('input[name=grpCharges]').attr('checked', false);
                $('input[name=cbslCharges]').attr('checked', false);
                document.getElementById("billto").value = "";
                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";

                document.getElementById("personalNextBtn").focus();
            }

            if ($(this).val() == "cbsl") {
                $('#submitBtnfinal').attr('disabled', true);

                $("#paymentonlinegr").hide();
                $("#paymentonlinegb").fadeIn();

                document.getElementById("personaldetailslabel").innerText = "Personal Details (Buyer)";
                document.getElementById("personaldetailslabelsum").innerText = "Personal Details (Buyer)";
                $("#bruHIMSNumberTemp").hide();
                $("#patientNumberTemp").hide();

                $("#personalsection").fadeIn();
                $("#personalNextBtn").fadeIn();

                $("#sectionone").hide();
                $("#sectiontwo").hide();
                $("#sectionthree").hide();
                $("#sectionfour").fadeIn();

                $("#appointmentDistrictMOH").hide();
                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $("#jpmcpjsc").hide();

                $("#sectionmohcharges").hide();
                $("#sectionjpmccharges").hide();
                $("#sectionphccharges").hide();
                $("#sectionlocalcharges").hide();
                $("#sectiongrpcharges").hide();
                $("#sectioncbslcharges").fadeIn();
                $("#paymentmethodarea").fadeIn();

                document.getElementById('patientNumber').value = '';
                document.getElementById('patientNumberTemp').value = '';
                $("#icpassportChoice").hide();
                $('input[name=icpassport]').attr('checked', false);
                $("#icarea").hide();
                document.getElementById('icnumber').value = '';
                $("#passportarea").hide();
                document.getElementById('passport').value = '';
                $('input[name=districtAppointment]').attr('checked', false);
                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";
                $('input[name=jpmcpjsc]').attr('checked', false);

                $('input[name=pickupordeliverygrp]').attr('checked', false);
                document.getElementById("grpTrack").value = "";
                document.getElementById("GoRushReceivingCountry").value = '';
                $('input[name=shipmentMethod]').attr('checked', false);
                document.getElementById("ecommerce").value = "";
                document.getElementById("commodities").value = "";
                document.getElementById("currency").value = "";
                document.getElementById("weight").value = "";
                $('input[name=permit]').attr('checked', false);
                $('input[name=itemContains]').attr('checked', false);
                document.getElementById("Item-Description").value = "";
                document.getElementById("Quantity").value = "";
                document.getElementById("Total-Item-Price").value = "";
                document.getElementById("itemPrice").value = "";

                $('input[name=pickupordelivery]').attr('checked', false);
                $("#pickupdatearea").hide();
                document.getElementById("pickupdate").value = "";
                $("#pickupaddressarea").hide();
                document.getElementById("pickupaddress").value = "";
                document.getElementById("productdescription").value = "";
                document.getElementById("producttype").value = "";
                document.getElementById("productweight").value = "";
                document.getElementById("receiverName").value = "";
                document.getElementById("receiverHouse").value = "";
                document.getElementById("receiverKampong").value = "";
                document.getElementById("receiverJalan").value = "";
                document.getElementById("receiverSimpang").value = "";
                $('input[name=receiverDistrict]').attr('checked', false);
                document.getElementById("receiverPostal").value = "";
                document.getElementById("receiverEmail").value = "";
                document.getElementById("receiverContact_1").value = "";

                $('input[name=pickupordeliverycbsl]').attr('checked', false);
                document.getElementById("GB-RS-Track").value = "";
                document.getElementById("GB-RS-Courier").value = "";
                document.getElementById("gbrsItemDescription").value = "";
                document.getElementById("GB-RS-Quantity").value = "";
                document.getElementById("GB-RS-Total-Amount").value = "";
                $("#paymentmethod option[value='Bank Transfer (Baiduri)']").hide();
                $("#paymentmethod option[value='Bank Transfer (BIBD)']").show();
                $("#paymentmethod option[value='Bill Payment (BIBD)']").hide();
                $("#paymentnotegr").hide();
                $("#paymentnotegb").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
                $('input[name=jpmcCharges]').attr('checked', false);
                $('input[name=jpmcPayingPatient]').attr('checked', false);
                $('input[name=phcCharges]').attr('checked', false);
                $('input[name=phcPayingPatient]').attr('checked', false);
                $('input[name=localCharges]').attr('checked', false);
                $('input[name=grpCharges]').attr('checked', false);
                $('input[name=cbslCharges]').attr('checked', false);
                document.getElementById("billto").value = "";
                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";

                document.getElementById("personalNextBtn").focus();
            }
        });

        document.getElementById("personalNextBtn").addEventListener("click", function () {
            if (document.getElementById('accessGroupName').value == "Joybean") {
                $("#mohhideimm").hide();
                $("#mohhideexp").hide();
                $("#mohimmidiate").hide();
                $("#mohexpress").hide();
                $("#mohstandard").hide();

                $("#jpmcexpressbm").hide();
                $("#jpmcstandardbm").hide();
                $("#jpmcstandardttg").hide();
                $("#jpmcstandardkb").hide();
                $("#jpmcstandardtemb").hide();

                $("#phcstandardkb").hide();
                $("#phcstandardttg").hide();
                $("#phcstandardbm").hide();
                $("#phcstandardtemb").hide();

                $("#grpdropoffbm").hide();
                $("#grpdropoffttg").hide();
                $("#grpdropoffkb").hide();
                $("#grpdropofftemb").hide();

                $("#cbsldropoffbm").hide();
                $("#cbsldropoffttg").hide();
                $("#cbsldropoffkb").hide();
                $("#cbsldropofftemb").hide();

                $("#grpimmediatebm").hide();
                $("#cbslimmediatebm").hide();

                $("#productweightArea").hide();
                $("#additionalChargeArea").hide();

                $("#icpassportChoice").hide();
                $('input[name=icpassport]').attr('checked', false);
                $("#icarea").hide();
                document.getElementById('icnumber').value = '';
                $("#passportarea").hide();
                document.getElementById('passport').value = '';
                $('input[name=districtAppointment]').attr('checked', false);
                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = '';
                document.getElementById("healthCentreTEMB").value = '';
                document.getElementById("healthCentreKB").value = '';
                document.getElementById("mapSource").src = "";
                $('input[name=jpmcpjsc]').attr('checked', false);

                $('input[name=pickupordeliverygrp]').attr('checked', false);
                document.getElementById("grpTrack").value = '';
                document.getElementById("GoRushReceivingCountry").value = '';
                $('input[name=shipmentMethod]').attr('checked', false);
                document.getElementById("ecommerce").value = '';
                document.getElementById("commodities").value = '';
                document.getElementById("currency").value = '';
                document.getElementById("weight").value = '';
                $('input[name=permit]').attr('checked', false);
                $('input[name=itemContains]').attr('checked', false);
                document.getElementById("Item-Description").value = '';
                document.getElementById("Quantity").value = '';
                document.getElementById("Total-Item-Price").value = '';
                document.getElementById("itemPrice").value = '';

                $('input[name=pickupordelivery][value="Pickup and Delivery"]').prop('checked', true);
                $("#pickupdatearea").fadeIn();
                document.getElementById("pickupdate").value = '';
                $("#pickupaddressarea").fadeIn();
                document.getElementById("pickupaddress").value = 'Unit GK5 Grd Floor Mid Valley Shopping Centre';
                document.getElementById("productdescription").value = '';
                document.getElementById("producttype").value = '';
                document.getElementById("productweight").value = "";
                document.getElementById("receiverName").value = 'Joybean Hua Ho Manggis';
                document.getElementById("receiverHouse").value = 'Basement 1, Hua Ho Department store';
                document.getElementById("receiverKampong").value = 'Kg Manggis';
                document.getElementById("receiverJalan").value = 'Jln Muara';
                document.getElementById("receiverSimpang").value = '';
                $('input[name=receiverDistrict][value="Brunei Muara"]').prop('checked', true);
                document.getElementById("receiverPostal").value = 'BC3615';
                document.getElementById("receiverEmail").value = '';
                document.getElementById("receiverContact_1").value = '7359759';

                $('input[name=pickupordeliverycbsl]').attr('checked', false);
                document.getElementById("GB-RS-Track").value = "";
                document.getElementById("GB-RS-Courier").value = "";
                document.getElementById("gbrsItemDescription").value = "";
                document.getElementById("GB-RS-Quantity").value = "";
                document.getElementById("GB-RS-Total-Amount").value = "";

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
                $('input[name=jpmcCharges]').attr('checked', false);
                $('input[name=jpmcPayingPatient]').attr('checked', false);
                $('input[name=phcCharges]').attr('checked', false);
                $('input[name=phcPayingPatient]').attr('checked', false);
                $('input[name=localCharges]').attr('checked', false);
                $('input[name=grpCharges]').attr('checked', false);
                $('input[name=cbslCharges]').attr('checked', false);
                document.getElementById("billto").value = "";
                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";
            } else {
                if ($('#district').val() == "brunei-muara") {
                    $("#mohhideimm").fadeIn();
                    $("#mohhideexp").fadeIn();
                    $("#mohimmidiate").fadeIn();
                    $("#mohexpress").fadeIn();
                    $("#mohstandard").fadeIn();

                    $("#jpmcexpressbm").fadeIn();
                    $("#jpmcstandardbm").fadeIn();
                    $("#jpmcstandardttg").hide();
                    $("#jpmcstandardkb").hide();
                    $("#jpmcstandardtemb").hide();

                    $("#phcstandardkb").hide();
                    $("#phcstandardttg").hide();
                    $("#phcstandardbm").fadeIn();
                    $("#phcstandardtemb").hide();

                    $("#grpdropoffbm").fadeIn();
                    $("#grpdropoffttg").hide();
                    $("#grpdropoffkb").hide();
                    $("#grpdropofftemb").hide();

                    $("#cbsldropoffbm").fadeIn();
                    $("#cbsldropoffttg").hide();
                    $("#cbsldropoffkb").hide();
                    $("#cbsldropofftemb").hide();

                    if (day != 0) {
                        if ((hour >= 8) && (hour < 15)) {
                            $("#grpimmediatebm").fadeIn();
                            $("#cbslimmediatebm").fadeIn();
                        } else {
                            $("#grpimmediatebm").hide();
                            $("#cbslimmediatebm").hide();
                        }
                    } else {
                        $("#grpimmediatebm").hide();
                        $("#cbslimmediatebm").hide();
                    }

                    $("#productweightArea").fadeIn();
                    $("#additionalChargeArea").fadeIn();

                    $("#icpassportChoice").hide();
                    $('input[name=icpassport]').attr('checked', false);
                    $("#icarea").hide();
                    document.getElementById('icnumber').value = '';
                    $("#passportarea").hide();
                    document.getElementById('passport').value = '';
                    $('input[name=districtAppointment]').attr('checked', false);
                    document.getElementById('healthCentreBM').value = '';
                    document.getElementById("healthCentreTTG").value = '';
                    document.getElementById("healthCentreTEMB").value = '';
                    document.getElementById("healthCentreKB").value = '';
                    document.getElementById("mapSource").src = "";
                    $('input[name=jpmcpjsc]').attr('checked', false);

                    $('input[name=pickupordeliverygrp]').attr('checked', false);
                    document.getElementById("grpTrack").value = '';
                    document.getElementById("GoRushReceivingCountry").value = '';
                    $('input[name=shipmentMethod]').attr('checked', false);
                    document.getElementById("ecommerce").value = '';
                    document.getElementById("commodities").value = '';
                    document.getElementById("currency").value = '';
                    document.getElementById("weight").value = '';
                    $('input[name=permit]').attr('checked', false);
                    $('input[name=itemContains]').attr('checked', false);
                    document.getElementById("Item-Description").value = '';
                    document.getElementById("Quantity").value = '';
                    document.getElementById("Total-Item-Price").value = '';
                    document.getElementById("itemPrice").value = '';

                    $('input[name=pickupordelivery]').attr('checked', false);
                    $("#pickupdatearea").hide();
                    document.getElementById("pickupdate").value = '';
                    $("#pickupaddressarea").hide();
                    document.getElementById("pickupaddress").value = '';
                    document.getElementById("productdescription").value = '';
                    document.getElementById("producttype").value = '';
                    document.getElementById("productweight").value = "";
                    document.getElementById("receiverName").value = '';
                    document.getElementById("receiverHouse").value = '';
                    document.getElementById("receiverKampong").value = '';
                    document.getElementById("receiverJalan").value = '';
                    document.getElementById("receiverSimpang").value = '';
                    $('input[name=receiverDistrict]').attr('checked', false);
                    document.getElementById("receiverPostal").value = '';
                    document.getElementById("receiverEmail").value = '';
                    document.getElementById("receiverContact_1").value = '';

                    $('input[name=pickupordeliverycbsl]').attr('checked', false);
                    document.getElementById("GB-RS-Track").value = "";
                    document.getElementById("GB-RS-Courier").value = "";
                    document.getElementById("gbrsItemDescription").value = "";
                    document.getElementById("GB-RS-Quantity").value = "";
                    document.getElementById("GB-RS-Total-Amount").value = "";

                    $('input[name=mohCharges]').attr('checked', false);
                    $('input[name=mohPayingPatient]').attr('checked', false);
                    $('input[name=jpmcCharges]').attr('checked', false);
                    $('input[name=jpmcPayingPatient]').attr('checked', false);
                    $('input[name=phcCharges]').attr('checked', false);
                    $('input[name=phcPayingPatient]').attr('checked', false);
                    $('input[name=localCharges]').attr('checked', false);
                    $('input[name=grpCharges]').attr('checked', false);
                    $('input[name=cbslCharges]').attr('checked', false);
                    document.getElementById("billto").value = "";
                    document.getElementById("paymentmethod").value = "";
                    document.getElementById("remarks").value = "";
                }

                if ($('#district').val() == "tutong") {
                    $("#mohhideimm").hide();
                    $("#mohhideexp").hide();
                    $("#mohimmidiate").hide();
                    $("#mohexpress").hide();
                    $("#mohstandard").fadeIn();

                    $("#jpmcexpressbm").hide();
                    $("#jpmcstandardbm").hide();
                    $("#jpmcstandardttg").fadeIn();
                    $("#jpmcstandardkb").hide();
                    $("#jpmcstandardtemb").hide();

                    $("#phcstandardkb").hide();
                    $("#phcstandardttg").fadeIn();
                    $("#phcstandardbm").hide();
                    $("#phcstandardtemb").hide();

                    $("#grpimmediatebm").hide();
                    $("#grpdropoffbm").hide();
                    $("#grpdropoffttg").fadeIn();
                    $("#grpdropoffkb").hide();
                    $("#grpdropofftemb").hide();

                    $("#cbslimmediatebm").hide();
                    $("#cbsldropoffbm").hide();
                    $("#cbsldropoffttg").fadeIn();
                    $("#cbsldropoffkb").hide();
                    $("#cbsldropofftemb").hide();

                    $("#productweightArea").fadeIn();
                    $("#additionalChargeArea").fadeIn();

                    $("#icpassportChoice").hide();
                    $('input[name=icpassport]').attr('checked', false);
                    $("#icarea").hide();
                    document.getElementById('icnumber').value = '';
                    $("#passportarea").hide();
                    document.getElementById('passport').value = '';
                    $('input[name=districtAppointment]').attr('checked', false);
                    document.getElementById('healthCentreBM').value = '';
                    document.getElementById("healthCentreTTG").value = '';
                    document.getElementById("healthCentreTEMB").value = '';
                    document.getElementById("healthCentreKB").value = '';
                    document.getElementById("mapSource").src = "";
                    $('input[name=jpmcpjsc]').attr('checked', false);

                    $('input[name=pickupordeliverygrp]').attr('checked', false);
                    document.getElementById("grpTrack").value = '';
                    document.getElementById("GoRushReceivingCountry").value = '';
                    $('input[name=shipmentMethod]').attr('checked', false);
                    document.getElementById("ecommerce").value = '';
                    document.getElementById("commodities").value = '';
                    document.getElementById("currency").value = '';
                    document.getElementById("weight").value = '';
                    $('input[name=permit]').attr('checked', false);
                    $('input[name=itemContains]').attr('checked', false);
                    document.getElementById("Item-Description").value = '';
                    document.getElementById("Quantity").value = '';
                    document.getElementById("Total-Item-Price").value = '';
                    document.getElementById("itemPrice").value = '';

                    $('input[name=pickupordelivery]').attr('checked', false);
                    $("#pickupdatearea").hide();
                    document.getElementById("pickupdate").value = '';
                    $("#pickupaddressarea").hide();
                    document.getElementById("pickupaddress").value = '';
                    document.getElementById("productdescription").value = '';
                    document.getElementById("producttype").value = '';
                    document.getElementById("productweight").value = "";
                    document.getElementById("receiverName").value = '';
                    document.getElementById("receiverHouse").value = '';
                    document.getElementById("receiverKampong").value = '';
                    document.getElementById("receiverJalan").value = '';
                    document.getElementById("receiverSimpang").value = '';
                    $('input[name=receiverDistrict]').attr('checked', false);
                    document.getElementById("receiverPostal").value = '';
                    document.getElementById("receiverEmail").value = '';
                    document.getElementById("receiverContact_1").value = '';

                    $('input[name=pickupordeliverycbsl]').attr('checked', false);
                    document.getElementById("GB-RS-Track").value = "";
                    document.getElementById("GB-RS-Courier").value = "";
                    document.getElementById("gbrsItemDescription").value = "";
                    document.getElementById("GB-RS-Quantity").value = "";
                    document.getElementById("GB-RS-Total-Amount").value = "";

                    $('input[name=mohCharges]').attr('checked', false);
                    $('input[name=mohPayingPatient]').attr('checked', false);
                    $('input[name=jpmcCharges]').attr('checked', false);
                    $('input[name=jpmcPayingPatient]').attr('checked', false);
                    $('input[name=phcCharges]').attr('checked', false);
                    $('input[name=phcPayingPatient]').attr('checked', false);
                    $('input[name=localCharges]').attr('checked', false);
                    $('input[name=grpCharges]').attr('checked', false);
                    $('input[name=cbslCharges]').attr('checked', false);
                    document.getElementById("billto").value = "";
                    document.getElementById("paymentmethod").value = "";
                    document.getElementById("remarks").value = "";
                }

                if ($('#district').val() == "temburong") {
                    $("#mohhideimm").hide();
                    $("#mohhideexp").hide();
                    $("#mohimmidiate").hide();
                    $("#mohexpress").hide();
                    $("#mohstandard").fadeIn();

                    $("#jpmcexpressbm").hide();
                    $("#jpmcstandardbm").hide();
                    $("#jpmcstandardttg").hide();
                    $("#jpmcstandardkb").hide();
                    $("#jpmcstandardtemb").fadeIn();

                    $("#phcstandardkb").hide();
                    $("#phcstandardttg").hide();
                    $("#phcstandardbm").hide()
                    $("#phcstandardtemb").fadeIn();

                    $("#grpimmediatebm").hide();
                    $("#grpdropoffbm").hide();
                    $("#grpdropoffttg").hide();
                    $("#grpdropoffkb").hide();
                    $("#grpdropofftemb").fadeIn();

                    $("#cbslimmediatebm").hide();
                    $("#cbsldropoffbm").hide();
                    $("#cbsldropoffttg").hide();
                    $("#cbsldropoffkb").hide();
                    $("#cbsldropofftemb").fadeIn();

                    $("#productweightArea").fadeIn();
                    $("#additionalChargeArea").fadeIn();

                    $("#icpassportChoice").hide();
                    $('input[name=icpassport]').attr('checked', false);
                    $("#icarea").hide();
                    document.getElementById('icnumber').value = '';
                    $("#passportarea").hide();
                    document.getElementById('passport').value = '';
                    $('input[name=districtAppointment]').attr('checked', false);
                    document.getElementById('healthCentreBM').value = '';
                    document.getElementById("healthCentreTTG").value = '';
                    document.getElementById("healthCentreTEMB").value = '';
                    document.getElementById("healthCentreKB").value = '';
                    document.getElementById("mapSource").src = "";
                    $('input[name=jpmcpjsc]').attr('checked', false);

                    $('input[name=pickupordeliverygrp]').attr('checked', false);
                    document.getElementById("grpTrack").value = '';
                    document.getElementById("GoRushReceivingCountry").value = '';
                    $('input[name=shipmentMethod]').attr('checked', false);
                    document.getElementById("ecommerce").value = '';
                    document.getElementById("commodities").value = '';
                    document.getElementById("currency").value = '';
                    document.getElementById("weight").value = '';
                    $('input[name=permit]').attr('checked', false);
                    $('input[name=itemContains]').attr('checked', false);
                    document.getElementById("Item-Description").value = '';
                    document.getElementById("Quantity").value = '';
                    document.getElementById("Total-Item-Price").value = '';
                    document.getElementById("itemPrice").value = '';

                    $('input[name=pickupordelivery]').attr('checked', false);
                    $("#pickupdatearea").hide();
                    document.getElementById("pickupdate").value = '';
                    $("#pickupaddressarea").hide();
                    document.getElementById("pickupaddress").value = '';
                    document.getElementById("productdescription").value = '';
                    document.getElementById("producttype").value = '';
                    document.getElementById("productweight").value = "";
                    document.getElementById("receiverName").value = '';
                    document.getElementById("receiverHouse").value = '';
                    document.getElementById("receiverKampong").value = '';
                    document.getElementById("receiverJalan").value = '';
                    document.getElementById("receiverSimpang").value = '';
                    $('input[name=receiverDistrict]').attr('checked', false);
                    document.getElementById("receiverPostal").value = '';
                    document.getElementById("receiverEmail").value = '';
                    document.getElementById("receiverContact_1").value = '';

                    $('input[name=pickupordeliverycbsl]').attr('checked', false);
                    document.getElementById("GB-RS-Track").value = "";
                    document.getElementById("GB-RS-Courier").value = "";
                    document.getElementById("gbrsItemDescription").value = "";
                    document.getElementById("GB-RS-Quantity").value = "";
                    document.getElementById("GB-RS-Total-Amount").value = "";

                    $('input[name=mohCharges]').attr('checked', false);
                    $('input[name=mohPayingPatient]').attr('checked', false);
                    $('input[name=jpmcCharges]').attr('checked', false);
                    $('input[name=jpmcPayingPatient]').attr('checked', false);
                    $('input[name=phcCharges]').attr('checked', false);
                    $('input[name=phcPayingPatient]').attr('checked', false);
                    $('input[name=localCharges]').attr('checked', false);
                    $('input[name=grpCharges]').attr('checked', false);
                    $('input[name=cbslCharges]').attr('checked', false);
                    document.getElementById("billto").value = "";
                    document.getElementById("paymentmethod").value = "";
                    document.getElementById("remarks").value = "";
                }

                if ($('#district').val() == "belait") {
                    $("#mohhideimm").hide();
                    $("#mohhideexp").hide();
                    $("#mohimmidiate").hide();
                    $("#mohexpress").hide();
                    $("#mohstandard").fadeIn();

                    $("#jpmcexpressbm").hide();
                    $("#jpmcstandardbm").hide();
                    $("#jpmcstandardttg").hide();
                    $("#jpmcstandardkb").fadeIn();
                    $("#jpmcstandardtemb").hide();

                    $("#phcstandardkb").fadeIn();
                    $("#phcstandardttg").hide();
                    $("#phcstandardbm").hide();
                    $("#phcstandardtemb").hide();

                    $("#grpimmediatebm").hide();
                    $("#grpdropoffbm").hide();
                    $("#grpdropoffttg").hide();
                    $("#grpdropoffkb").fadeIn();
                    $("#grpdropofftemb").hide();

                    $("#cbslimmediatebm").hide();
                    $("#cbsldropoffbm").hide();
                    $("#cbsldropoffttg").hide();
                    $("#cbsldropoffkb").fadeIn();
                    $("#cbsldropofftemb").hide();

                    $("#productweightArea").fadeIn();
                    $("#additionalChargeArea").fadeIn();

                    $("#icpassportChoice").hide();
                    $('input[name=icpassport]').attr('checked', false);
                    $("#icarea").hide();
                    document.getElementById('icnumber').value = '';
                    $("#passportarea").hide();
                    document.getElementById('passport').value = '';
                    $('input[name=districtAppointment]').attr('checked', false);
                    document.getElementById('healthCentreBM').value = '';
                    document.getElementById("healthCentreTTG").value = '';
                    document.getElementById("healthCentreTEMB").value = '';
                    document.getElementById("healthCentreKB").value = '';
                    document.getElementById("mapSource").src = "";
                    $('input[name=jpmcpjsc]').attr('checked', false);

                    $('input[name=pickupordeliverygrp]').attr('checked', false);
                    document.getElementById("grpTrack").value = '';
                    document.getElementById("GoRushReceivingCountry").value = '';
                    $('input[name=shipmentMethod]').attr('checked', false);
                    document.getElementById("ecommerce").value = '';
                    document.getElementById("commodities").value = '';
                    document.getElementById("currency").value = '';
                    document.getElementById("weight").value = '';
                    $('input[name=permit]').attr('checked', false);
                    $('input[name=itemContains]').attr('checked', false);
                    document.getElementById("Item-Description").value = '';
                    document.getElementById("Quantity").value = '';
                    document.getElementById("Total-Item-Price").value = '';
                    document.getElementById("itemPrice").value = '';

                    $('input[name=pickupordelivery]').attr('checked', false);
                    $("#pickupdatearea").hide();
                    document.getElementById("pickupdate").value = '';
                    $("#pickupaddressarea").hide();
                    document.getElementById("pickupaddress").value = '';
                    document.getElementById("productdescription").value = '';
                    document.getElementById("producttype").value = '';
                    document.getElementById("productweight").value = "";
                    document.getElementById("receiverName").value = '';
                    document.getElementById("receiverHouse").value = '';
                    document.getElementById("receiverKampong").value = '';
                    document.getElementById("receiverJalan").value = '';
                    document.getElementById("receiverSimpang").value = '';
                    $('input[name=receiverDistrict]').attr('checked', false);
                    document.getElementById("receiverPostal").value = '';
                    document.getElementById("receiverEmail").value = '';
                    document.getElementById("receiverContact_1").value = '';

                    $('input[name=pickupordeliverycbsl]').attr('checked', false);
                    document.getElementById("GB-RS-Track").value = "";
                    document.getElementById("GB-RS-Courier").value = "";
                    document.getElementById("gbrsItemDescription").value = "";
                    document.getElementById("GB-RS-Quantity").value = "";
                    document.getElementById("GB-RS-Total-Amount").value = "";

                    $('input[name=mohCharges]').attr('checked', false);
                    $('input[name=mohPayingPatient]').attr('checked', false);
                    $('input[name=jpmcCharges]').attr('checked', false);
                    $('input[name=jpmcPayingPatient]').attr('checked', false);
                    $('input[name=phcCharges]').attr('checked', false);
                    $('input[name=phcPayingPatient]').attr('checked', false);
                    $('input[name=localCharges]').attr('checked', false);
                    $('input[name=grpCharges]').attr('checked', false);
                    $('input[name=cbslCharges]').attr('checked', false);
                    document.getElementById("billto").value = "";
                    document.getElementById("paymentmethod").value = "";
                    document.getElementById("remarks").value = "";
                }
            }
            $("#productselectionsection").hide();
            $("#personalNextBtn").hide();
            $("#personalsection").hide();
            $("#productNextBtn").fadeIn();
            $("#productsPrevBtn").fadeIn();
            $("#productsection").fadeIn();

            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        $('input[name=districtAppointment]').change(function () {
            if ($(this).val().length == 0) {
                $("#appointmentDistrictBM").hide();
                $("#appointmentDistrictTTG").hide();
                $("#appointmentDistrictTEMB").hide();
                $("#appointmentDistrictKB").hide();

                $("#mohimmidiate").hide();
                $("#mohexpress").hide();

                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);

                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";
            }

            if ($(this).val() == "Brunei Muara") {
                $("#appointmentDistrictBM").fadeIn();
                $("#appointmentDistrictTTG").hide();
                $("#appointmentDistrictTEMB").hide();
                $("#appointmentDistrictKB").hide();

                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }

                $("#mohexpress").fadeIn();

                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);

                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";
            }

            if ($(this).val() == "Tutong") {
                $("#appointmentDistrictBM").hide();
                $("#appointmentDistrictTTG").fadeIn();
                $("#appointmentDistrictTEMB").hide();
                $("#appointmentDistrictKB").hide();

                $("#mohimmidiate").hide();
                $("#mohexpress").hide();

                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);

                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";
            }

            if ($(this).val() == "Temburong") {
                $("#appointmentDistrictBM").hide();
                $("#appointmentDistrictTTG").hide();
                $("#appointmentDistrictTEMB").fadeIn();
                $("#appointmentDistrictKB").hide();

                $("#mohimmidiate").hide();
                $("#mohexpress").hide();

                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);

                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";
            }

            if ($(this).val() == "Belait") {
                $("#appointmentDistrictBM").hide();
                $("#appointmentDistrictTTG").hide();
                $("#appointmentDistrictTEMB").hide();
                $("#appointmentDistrictKB").fadeIn();

                $("#mohimmidiate").hide();
                $("#mohexpress").hide();

                document.getElementById('healthCentreBM').value = '';
                document.getElementById("healthCentreTTG").value = "";
                document.getElementById("healthCentreTEMB").value = "";
                document.getElementById("healthCentreKB").value = "";
                document.getElementById("mapSource").src = "";

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);

                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";
            }
        });

        $('#healthCentreBM').change(function () {
            if ($(this).val().length == 0) {
                $("#mohimmidiate").hide();
                document.getElementById("mapSource").src = "";
                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Raja Isteri Pengiran Anak Saleha Hospital") {

                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 15)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }

                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.2805202346863!2d114.93130540523119!3d4.892630019678778!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32228acb18b46725%3A0x9118155b10d353ca!2sRaja%20Isteri%20Pengiran%20Anak%20Saleha%20Hospital!5e0!3m2!1sen!2sbn!4v1634281650713!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Pengkalan Batu Health Centre") {

                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }

                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.9930134353094!2d114.81397081532558!3d4.771159642369682!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x322263643d7b9bf9%3A0xab86d8cb5835ceda!2sPengkalan%20Batu%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634285210387!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }


            if ($(this).val() == "Jubli Perak Sengkurong Health Centre") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.2877506842783!2d114.84314291532539!3d4.891412441334922!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32226084b479a23b%3A0xf3137ef638ed3cfd!2sJubli%20Perak%20Sengkurong%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634285543314!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Jubli Emas Kg Perpindahan Bunut Health Centre") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.547397189751!2d114.88291741532552!3d4.847486841715639!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x322261c61f38a619%3A0x3a6a37bd46269d3a!2sJubli%20Emas%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634285599556!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Pengiran Anak Puteri Hajah Rashidah Sa'adatul Bolkiah Health Centre") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.3769360804904!2d114.9340483153255!3d4.876369041465689!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32228ac25aec45df%3A0x8707ccd2be1d106b!2sPAPHRSB%20SG%20ASAM%20HEALTH%20CENTRE!5e0!3m2!1sen!2sbn!4v1634285838280!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Pengiran Anak Puteri Hajah Muta-Wakillah Hayatul Bolkiah Health Centre") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.0479626441015!2d114.90431041532548!3d4.9316318409836315!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3222f57fa2c50b8f%3A0x5e99dc6cafc60b21!2sPengiran%20Anak%20Puteri%20Hajah%20Muta-Wakillah%20Hayatul%20Bolkiah%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634285881919!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Rimba Dialysis Centre") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d993.762589183511!2d114.9064117!3d4.9312319!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3222f57fb34628ab%3A0xe11b4fd5ed3d2ce1!2sRimba%20Dialysis%20Centre!5e0!3m2!1sen!2sbn!4v1636339406654!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Berakas Health Centre") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3974.828175459776!2d114.9636824153256!3d4.96821124066185!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3222f42787932131%3A0xf9ab86325b87674!2sPusat%20Kesihatan%20Berakas!5e0!3m2!1sen!2sbn!4v1634285920206!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Muara Health Centre") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3974.4576007276696!2d115.06447081532535!3d5.029285440119686!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3222f06dcb40542b%3A0xdce8b6a5b55c836d!2sMuara%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634285963322!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Psychiatry Department, Ministry of Health") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.254386052767!2d114.90992181532567!3d4.897028391286052!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3222f553a7c821df%3A0x65c23364c25df9!2sPsychiatry%20Department%2C%20Ministry%20of%20Health!5e0!3m2!1sen!2sbn!4v1634992947581!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "KG Bolkiah") {
                $("#mohimmidiate").hide();
                document.getElementById("mapSource").src = "";
                $("#hcAreaMapAddress").hide();
                $("#clinicAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "SG Bunga") {
                $("#mohimmidiate").hide();
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.1432004986946!2d115.01193264313245!3d4.915696991808234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3222f36f1f0926d9%3A0x5eb0de579e4e2269!2sSungai%20Bunga%20Health%20Clinic%2C%20Kampong%20Sungai%20Bunga!5e0!3m2!1sen!2sbn!4v1634286214099!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "JPMC") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1181.7582787740073!2d114.82977193840651!3d4.948768090298503!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32225e93638da5b1%3A0x90bf9d36cc534c7c!2sJerudong%20Park%20Medical%20Centre!5e0!3m2!1sen!2sbn!4v1637046171509!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "PJSC") {
                if ((day != 0) && (day != 5)) {
                    if ((hour >= 8) && (hour < 12)) {
                        $("#mohimmidiate").fadeIn();
                    } else {
                        $("#mohimmidiate").hide();
                    }
                } else {
                    $("#mohimmidiate").hide();
                }
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1181.7576714939253!2d114.83085643710163!3d4.949108116049822!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32225e9367a66cc1%3A0x3a6601d28e30b574!2sPantai%20Jerudong%20Specialist%20Centre%20(PJSC)!5e0!3m2!1sen!2sbn!4v1637046289863!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }
        });

        $('#healthCentreTTG').change(function () {
            if ($(this).val().length == 0) {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "";
                $("#hcAreaMapAddress").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Pengiran Muda Mahkota Pengiran Muda Haji Al-Muhtadee Billah Hospital") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.7255630496174!2d114.66117111532566!3d4.817114541977045!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32226ed9a59e46a5%3A0x62066e860030b362!2sPengiran%20Muda%20Mahkota%20Pengiran%20Muda%20Haji%20Al-Muhtadee%20Billah%20Hospital!5e0!3m2!1sen!2sbn!4v1634286463485!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Telisai Health Centre") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3976.1839730746256!2d114.5578142153256!3d4.738075742650269!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3222728d5f0c92a9%3A0xdae9ecd7acf168f9!2sTelisai%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634286496075!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Pekan Tutong Health Centre") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.719887312785!2d114.66105286532566!3d4.81808504196872!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32226ed9c57b185f%3A0x24d45d637ed2282c!2sPusat%20Kesihatan%20Tutong!5e0!3m2!1sen!2sbn!4v1634286553112!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Sungai Kelugos Health Centre") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3975.7792578580184!2d114.76881401532557!3d4.807923542055853!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x322264370344a2a7%3A0xc548e1a7c1521657!2sSungai%20Kelugos%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634286594839!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Lamunin Health Centre") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3976.5164928667486!2d114.7123597153257!3d4.67990954313922!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32227a0759340203%3A0x40335e9d8c7eefc1!2sLamunin%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634286641487!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }
        });

        $('#healthCentreKB').change(function () {
            if ($(this).val().length == 0) {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "";
                $("#hcAreaMapAddress").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Suri Seri Begawan Hospital") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3977.058923325921!2d114.19682271532564!3d4.583444243937976!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3218aa53c0d42c6b%3A0x4309941067d4ea11!2sSuri%20Seri%20Begawan%20Hospital!5e0!3m2!1sen!2sbn!4v1634286771871!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Kuala Belait Health Centre") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d9459.07903208395!2d114.20090259074068!3d4.584540049961497!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3218aa33ffffffff%3A0xabcd114352fec08d!2sKuala%20Belait%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634286806620!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Seria Health Centre") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3976.905812341586!2d114.33414371532547!3d4.610877343712345!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3218a7ffbcb7121d%3A0x225eeee88bbd0d4e!2sSeria%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634286841382!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Sungai Liang Health Centre") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3976.5325189388823!2d114.49268721532552!3d4.677087943162768!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x32220b66a610f693%3A0x9385789cab5ba672!2sSungai%20Liang%20Health%20Centre!5e0!3m2!1sen!2sbn!4v1634286874162!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }
        });

        $('#healthCentreTEMB').change(function () {
            if ($(this).val().length == 0) {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "";
                $("#hcAreaMapAddress").hide();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Pengiran Isteri Hajah Mariam Hospital") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3976.3398029284485!2d115.0750711153255!3d4.710906342879327!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3222853b9a771fd5%3A0xb426306755a3d508!2sPengiran%20Isteri%20Hajjah%20Mariam%20Hospital!5e0!3m2!1sen!2sbn!4v1634286943427!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }

            if ($(this).val() == "Bangar Health Clinic") {
                $("#clinicAddress").hide();
                document.getElementById("mapSource").src = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3976.337380807763!2d115.07532101532566!3d4.711329842875782!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x322285c84bc026a1%3A0xcf7e5ef899e3115!2sKlinik%20Kesihatan%20Bangar%2C%20Temburong!5e0!3m2!1sen!2sbn!4v1634286972450!5m2!1sen!2sbn";
                $("#hcAreaMapAddress").fadeIn();

                $('input[name=mohCharges]').attr('checked', false);
                $('input[name=mohPayingPatient]').attr('checked', false);
            }
        });

        $("#remove_fields").hide();

        document.getElementById("add_more_fields").addEventListener("click", addItems);
        document.getElementById("remove_fields").addEventListener("click", removeItems);

        var additional_item = document.getElementById('additional_item');
        var countadd = 0;

        function addItems() {

            var newheading = document.createElement('h4');
            newheading.innerHTML = "Additional ltem Details " + (countadd + 1);
            additional_item.appendChild(newheading);

            var newDiv = document.createElement("div");
            newDiv.setAttribute("id", "itemnamearea" + (countadd + 1))
            additional_item.appendChild(newDiv);


            var newLabel = document.createElement('label');
            newLabel.innerHTML = "Item Description:*";
            document.getElementById("itemnamearea" + (countadd + 1)).appendChild(newLabel);

            var newField = document.createElement('input');
            newField.setAttribute('type', 'text');
            newField.setAttribute('class', 'w-input');
            newField.setAttribute('maxlength', '256');
            newField.setAttribute('name', 'Item Description ' + (countadd + 1));
            newField.setAttribute('data-name', 'Item Description ' + (countadd + 1));
            newField.setAttribute('id', 'Item-Description-' + (countadd + 1));
            newField.setAttribute('placeholder', 'Enter Item Description');
            document.getElementById("itemnamearea" + (countadd + 1)).appendChild(newField);

            var newDiv = document.createElement("div");
            newDiv.setAttribute("id", "quantityarea" + (countadd + 1))
            additional_item.appendChild(newDiv);

            var newLabel = document.createElement('label');
            newLabel.innerHTML = "Quantity:*";
            document.getElementById("quantityarea" + (countadd + 1)).appendChild(newLabel);

            var newField = document.createElement('input');
            newField.setAttribute('type', 'number');
            newField.setAttribute('class', 'w-input');
            newField.setAttribute('maxlength', '5');
            newField.setAttribute('name', 'Quantity ' + (countadd + 1));
            newField.setAttribute('data-name', 'Quantity ' + (countadd + 1));
            newField.setAttribute('id', 'Quantity-' + (countadd + 1));
            newField.setAttribute('placeholder', 'Enter Quantity');
            document.getElementById("quantityarea" + (countadd + 1)).appendChild(newField);

            var newDiv = document.createElement("div");
            newDiv.setAttribute("id", "totalitempricearea" + (countadd + 1))
            additional_item.appendChild(newDiv);

            var newLabel = document.createElement('label');
            newLabel.innerHTML = "Total Item Price:*";
            document.getElementById("totalitempricearea" + (countadd + 1)).appendChild(newLabel);

            var newField = document.createElement('input');
            newField.setAttribute('type', 'number')
            newField.setAttribute('step', '.01')
            newField.setAttribute('class', 'w-input itemprice');
            newField.setAttribute('maxlength', '256');
            newField.setAttribute('name', 'Total Item Price ' + (countadd + 1));
            newField.setAttribute('data-name', 'Total Item Price ' + (countadd + 1));
            newField.setAttribute('id', 'Total-Item-Price-' + (countadd + 1));
            newField.setAttribute('placeholder', 'Enter Total Item Price');
            document.getElementById("totalitempricearea" + (countadd + 1)).appendChild(newField);

            countadd = countadd + 1;

            $("#remove_fields").fadeIn();
        }

        function removeItems() {
            var div_tags = additional_item.getElementsByTagName('div');
            var heading_tags = additional_item.getElementsByTagName('h4');
            if (div_tags.length != 0) {
                additional_item.removeChild(div_tags[(div_tags.length) - 1]);
                additional_item.removeChild(div_tags[(div_tags.length) - 1]);
                additional_item.removeChild(div_tags[(div_tags.length) - 1]);
                additional_item.removeChild(heading_tags[(heading_tags.length) - 1]);
                countadd = countadd - 1;

                if (div_tags.length == 0) {
                    $("#remove_fields").hide();
                }
            }
        }

        $('input[name=receiverDistrict]').change(function () {
            if ($(this).val().length == 0) {
                $("#gostandardbm").hide();
                $("#gostandardttg").hide();
                $("#gostandardkb").hide();
                $("#gostandardtemb").hide();
                $("#goexpressbm").hide();
                $("#godropoffbm").hide();
                $("#godropoffttg").hide();
                $("#godropoffkb").hide();
                $("#goexpressjb").hide();

                $('input[name=localCharges]').attr('checked', false);
                document.getElementById("billto").value = "";
                document.getElementById("paymentmethod").value = "";
                document.getElementById("remarks").value = "";
            }

            if ($(this).val().length != 0) {
                if (document.getElementById('accessGroupName').value == 'Joybean') {
                    $("#gostandardbm").hide();
                    $("#gostandardttg").hide();
                    $("#gostandardkb").hide();
                    $("#gostandardtemb").hide();
                    $("#goexpressbm").hide();
                    $("#godropoffbm").hide();
                    $("#godropoffttg").hide();
                    $("#godropoffkb").hide();
                    $("#goexpressjb").fadeIn();

                    $('input[name=localCharges]').attr('checked', false);
                    document.getElementById("billto").value = "";
                    document.getElementById("paymentmethod").value = "";
                    document.getElementById("remarks").value = "";
                } else {
                    if ($(this).val() == "Brunei Muara") {
                        $("#gostandardbm").fadeIn();
                        $("#gostandardttg").hide();
                        $("#gostandardkb").hide();
                        $("#gostandardtemb").hide();
                        $("#goexpressbm").fadeIn();
                        $("#godropoffbm").fadeIn();
                        $("#godropoffttg").hide();
                        $("#godropoffkb").hide();
                        $("#goexpressjb").hide();

                        $('input[name=localCharges]').attr('checked', false);
                        document.getElementById("billto").value = "";
                        document.getElementById("paymentmethod").value = "";
                        document.getElementById("remarks").value = "";
                    }

                    if ($(this).val() == "Tutong") {
                        $("#gostandardbm").hide();
                        $("#gostandardttg").fadeIn();
                        $("#gostandardkb").hide();
                        $("#gostandardtemb").hide();
                        $("#goexpressbm").hide();
                        $("#godropoffbm").hide();
                        $("#godropoffttg").fadeIn();
                        $("#godropoffkb").hide();
                        $("#goexpressjb").hide();

                        $('input[name=localCharges]').attr('checked', false);
                        document.getElementById("billto").value = "";
                        document.getElementById("paymentmethod").value = "";
                        document.getElementById("remarks").value = "";
                    }

                    if ($(this).val() == "Temburong") {
                        $("#gostandardbm").hide();
                        $("#gostandardttg").hide();
                        $("#gostandardkb").hide();
                        $("#gostandardtemb").fadeIn();
                        $("#goexpressbm").hide();
                        $("#godropoffbm").hide();
                        $("#godropoffttg").hide();
                        $("#godropoffkb").hide();
                        $("#goexpressjb").hide();

                        $('input[name=localCharges]').attr('checked', false);
                        document.getElementById("billto").value = "";
                        document.getElementById("paymentmethod").value = "";
                        document.getElementById("remarks").value = "";
                    }

                    if ($(this).val() == "Belait") {
                        $("#gostandardbm").hide();
                        $("#gostandardttg").hide();
                        $("#gostandardkb").fadeIn();
                        $("#gostandardtemb").hide();
                        $("#goexpressbm").hide();
                        $("#godropoffbm").hide();
                        $("#godropoffttg").hide();
                        $("#godropoffkb").fadeIn();
                        $("#goexpressjb").hide();

                        $('input[name=localCharges]').attr('checked', false);
                        document.getElementById("billto").value = "";
                        document.getElementById("paymentmethod").value = "";
                        document.getElementById("remarks").value = "";
                    }
                }
            }
        });

        $('input[name=pickupordelivery]').change(function () {
            if ($(this).val().length == 0) {
                $("#pickupdatearea").hide();
                $("#pickupaddressarea").hide();

                document.getElementById('pickupdate').value = '';
                document.getElementById('pickupaddress').value = '';
            }

            if ($(this).val() == "Delivery Only") {
                $("#pickupdatearea").hide();
                $("#pickupaddressarea").hide();

                document.getElementById('pickupdate').value = '';
                document.getElementById('pickupaddress').value = '';
            }

            if ($(this).val() == "Pickup and Delivery") {
                $("#pickupdatearea").fadeIn();
                $("#pickupaddressarea").fadeIn();

                document.getElementById('pickupdate').value = '';
                document.getElementById('pickupaddress').value = '';
            }
        });

        document.getElementById("productNextBtn").addEventListener("click", function () {
            if (($('input[name=products]:checked').val() == "pharmacymoh")) {
                if (($("#bruHIMSNumberTemp").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the patient's Bru-HIMs number field empty!");
                }

                if ($('input[name=districtAppointment]:checked').val() == undefined) {
                    $("#chargessection").hide();
                    alert("Please choose one of the appointment districts!");
                }

                if (($('input[name=districtAppointment]:checked').val() == "Brunei Muara")) {
                    if (($("#healthCentreBM").val().length == 0)) {
                        $("#chargessection").hide();
                        alert("Please choose one of the Brunei Muara Health Centres!");
                    }
                }

                if (($('input[name=districtAppointment]:checked').val() == "Tutong")) {
                    if (($("#healthCentreTTG").val().length == 0)) {
                        $("#chargessection").hide();
                        alert("Please choose one of the Tutong Health Centres!");
                    }
                }

                if (($('input[name=districtAppointment]:checked').val() == "Temburong")) {
                    if (($("#healthCentreTEMB").val().length == 0)) {
                        $("#chargessection").hide();
                        alert("Please choose one of the Temburong Health Centres!");
                    }
                }

                if (($('input[name=districtAppointment]:checked').val() == "Belait")) {
                    if (($("#healthCentreKB").val().length == 0)) {
                        $("#chargessection").hide();
                        alert("Please choose one of the Belait Health Centres!");
                    }
                }

                if (($("#bruHIMSNumberTemp").val().length != 0) && ($('input[name=districtAppointment]:checked').val() != undefined)) {
                    if (($('input[name=districtAppointment]:checked').val() == "Brunei Muara")) {
                        if (($("#healthCentreBM").val().length != 0)) {
                            $("#productNextBtn").hide();
                            $("#productsection").hide();
                            $("#productsPrevBtn").hide();
                            $("#chargessection").fadeIn();
                            $("#chargesNextBtn").fadeIn();
                            $("#chargesPrevBtn").fadeIn();

                            document.getElementById("patientNumber").value = document.getElementById("bruHIMSNumberTemp").value;

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }

                    if (($('input[name=districtAppointment]:checked').val() == "Tutong")) {
                        if (($("#healthCentreTTG").val().length != 0)) {
                            $("#productNextBtn").hide();
                            $("#productsection").hide();
                            $("#productsPrevBtn").hide();
                            $("#chargessection").fadeIn();
                            $("#chargesNextBtn").fadeIn();
                            $("#chargesPrevBtn").fadeIn();

                            document.getElementById("patientNumber").value = document.getElementById("bruHIMSNumberTemp").value;

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }

                    if (($('input[name=districtAppointment]:checked').val() == "Temburong")) {
                        if (($("#healthCentreTEMB").val().length != 0)) {
                            $("#productNextBtn").hide();
                            $("#productsection").hide();
                            $("#productsPrevBtn").hide();
                            $("#chargessection").fadeIn();
                            $("#chargesNextBtn").fadeIn();
                            $("#chargesPrevBtn").fadeIn();

                            document.getElementById("patientNumber").value = document.getElementById("bruHIMSNumberTemp").value;

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }

                    if (($('input[name=districtAppointment]:checked').val() == "Belait")) {
                        if (($("#healthCentreKB").val().length != 0)) {
                            $("#productNextBtn").hide();
                            $("#productsection").hide();
                            $("#productsPrevBtn").hide();
                            $("#chargessection").fadeIn();
                            $("#chargesNextBtn").fadeIn();
                            $("#chargesPrevBtn").fadeIn();

                            document.getElementById("patientNumber").value = document.getElementById("bruHIMSNumberTemp").value;

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }
                }
            }

            if (($('input[name=products]:checked').val() == "pharmacyjpmc")) {
                if (($("#patientNumberTemp").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the patient's number field empty!");
                }

                if ($('input[name=jpmcpjsc]:checked').val() == undefined) {
                    $("#chargessection").hide();
                    alert("Please choose one, JPMC or PJSC!");
                }

                if (($("#patientNumberTemp").val().length != 0) && ($('input[name=jpmcpjsc]:checked').val() != undefined)) {
                    $("#productNextBtn").hide();
                    $("#productsection").hide();
                    $("#productsPrevBtn").hide();
                    $("#chargessection").fadeIn();
                    $("#chargesNextBtn").fadeIn();
                    $("#chargesPrevBtn").fadeIn();

                    document.getElementById("patientNumber").value = document.getElementById("patientNumberTemp").value;

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            if (($('input[name=products]:checked').val() == "pharmacyphc")) {

                if (($("#patientNumberTemp").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the patient's number field empty!");
                }

                if ($("#patientNumberTemp").val().length != 0) {
                    $("#productNextBtn").hide();
                    $("#productsection").hide();
                    $("#productsPrevBtn").hide();
                    $("#chargessection").fadeIn();
                    $("#chargesNextBtn").fadeIn();
                    $("#chargesPrevBtn").fadeIn();

                    document.getElementById("patientNumber").value = document.getElementById("patientNumberTemp").value;

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            if (($('input[name=products]:checked').val() == "grp")) {
                if ($('input[name=pickupordeliverygrp]:checked').val() == undefined) {
                    $("#chargessection").hide();
                    alert("Please choose one of the methods!");
                }
                if (($("#grpTrack").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the parcel tracking number field empty!");
                }

                if (($("#GoRushReceivingCountry").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the Go Rush Receiving Country field empty!");
                }

                if ($('input[name=shipmentMethod]:checked').val() == undefined) {
                    $("#chargessection").hide();
                    alert("Please choose one of the shipment methods!");
                }

                if (($("#ecommerce").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the E-Commerce name field empty!");
                }

                if (($("#commodities").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the commodities field empty!");
                }

                if (($("#currency").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the currency field empty!");
                }

                if (($("#weight").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the weight field empty!");
                }

                if ($('input[name=permit]:checked').val() == undefined) {
                    $("#chargessection").hide();
                    alert("Please choose if there is permit or not!");
                }

                if ($('input[name=itemContains]:checked').val() == undefined) {
                    $("#chargessection").hide();
                    alert("Please choose if your item contains the following or not!");
                }

                if (($("#Item-Description").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the item description field empty!");
                }

                if (($("#Quantity").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the quantity field empty!");
                }

                if (($("#Total-Item-Price").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the total item price field empty!");
                }

                if (($('input[name=pickupordeliverygrp]:checked').val() != undefined) && ($("#grpTrack").val().length != 0) && ($("#GoRushReceivingCountry").val().length != 0)
                    && ($('input[name=shipmentMethod]:checked').val() != undefined) && ($("#ecommerce").val().length != 0)
                    && ($("#commodities").val().length != 0) && ($("#currency").val().length != 0)
                    && ($("#weight").val().length != 0) && ($('input[name=permit]:checked').val() != undefined)
                    && ($('input[name=itemContains]:checked').val() != undefined) && ($("#Item-Description").val().length != 0)
                    && ($("#Quantity").val().length != 0) && ($("#Total-Item-Price").val().length != 0)) {

                    if ($('input[name=pickupordeliverygrp]:checked').val() == "pickup") {
                        $("#sectiongrpcharges").hide();

                    } else {
                        $("#sectiongrpcharges").fadeIn();
                    }

                    $("#productNextBtn").hide();
                    $("#productsection").hide();
                    $("#productsPrevBtn").hide();
                    $("#chargessection").fadeIn();
                    $("#chargesNextBtn").fadeIn();
                    $("#chargesPrevBtn").fadeIn();

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            if (($('input[name=products]:checked').val() == "localdelivery")) {
                if (document.getElementById('accessGroupName').value == "Joybean") {
                    $("#billto").val("Sender");
                    $("#paymentmethod").val("Bill Payment (BIBD)");

                    $("#gostandardbm").hide();
                    $("#gostandardttg").hide();
                    $("#gostandardkb").hide();
                    $("#gostandardtemb").hide();
                    $("#goexpressbm").hide();
                    $("#godropoffbm").hide();
                    $("#godropoffttg").hide();
                    $("#godropoffkb").hide();
                    $("#goexpressjb").fadeIn();

                    $('input[name=localCharges][value="Express Joybean"]').prop('checked', true);
                }

                if ($('input[name=pickupordelivery]:checked').val() == undefined) {
                    $("#chargessection").hide();
                    alert("Please choose either pickup or delivery!");
                }

                if (($('input[name=pickupordelivery]:checked').val() == "Pickup and Delivery")) {
                    if (($("#pickupdate").val().length == 0)) {
                        $("#chargessection").hide();
                        alert("Please do not leave the pick-up date field empty!");
                    }

                    if (($("#pickupaddress").val().length == 0)) {
                        $("#chargessection").hide();
                        alert("Please do not leave the pick-up address field empty!");
                    }
                }

                if (($("#productdescription").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the product description field empty!");
                }

                if (($("#producttype").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the product type field empty!");
                }

                if (document.getElementById('accessGroupName').value != "Joybean") {
                    if ($("#productweight").val().length == 0) {
                        $("#chargessection").hide();
                        alert("Please choose the product weight!");
                    }
                }

                if (($("#receiverName").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the receiver name field empty!");
                }

                if (($("#receiverHouse").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the receiver house/unit number field empty!");
                }

                if (($("#receiverKampong").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the receiver kampong field empty!");
                }

                if (($("#receiverJalan").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the receiver jalan field empty!");
                }

                if ($('input[name=receiverDistrict]:checked').val() == undefined) {
                    $("#chargessection").hide();
                    alert("Please choose the receiver's district!");
                }

                if (($("#receiverContact_1").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the receiver phone number field empty!");
                }

                if (document.getElementById('accessGroupName').value != "Joybean") {
                    if (($('input[name=pickupordelivery]:checked').val() != undefined) && ($("#productdescription").val().length != 0)
                        && ($("#producttype").val().length != 0) && ($("#productweight").val().length != 0)
                        && ($("#receiverName").val().length != 0) && ($("#receiverHouse").val().length != 0)
                        && ($("#receiverKampong").val().length != 0) && ($("#receiverJalan").val().length != 0)
                        && ($('input[name=receiverDistrict]:checked').val() != undefined) && ($("#receiverContact_1").val().length != 0)) {
                        if (($('input[name=pickupordelivery]:checked').val() == "Pickup and Delivery")) {
                            if (($("#pickupdate").val().length != 0) && ($("#pickupaddress").val().length != 0)) {
                                $("#productNextBtn").hide();
                                $("#productsection").hide();
                                $("#productsPrevBtn").hide();
                                $("#chargessection").fadeIn();
                                $("#chargesNextBtn").fadeIn();
                                $("#chargesPrevBtn").fadeIn();

                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                        }

                        if (($('input[name=pickupordelivery]:checked').val() == "Delivery Only")) {
                            $("#productNextBtn").hide();
                            $("#productsection").hide();
                            $("#productsPrevBtn").hide();
                            $("#chargessection").fadeIn();
                            $("#chargesNextBtn").fadeIn();
                            $("#chargesPrevBtn").fadeIn();

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }


                    }
                } else {
                    if (($('input[name=pickupordelivery]:checked').val() != undefined) && ($("#productdescription").val().length != 0)
                        && ($("#producttype").val().length != 0)
                        && ($("#receiverName").val().length != 0) && ($("#receiverHouse").val().length != 0)
                        && ($("#receiverKampong").val().length != 0) && ($("#receiverJalan").val().length != 0)
                        && ($('input[name=receiverDistrict]:checked').val() != undefined) && ($("#receiverContact_1").val().length != 0)) {
                        if (($('input[name=pickupordelivery]:checked').val() == "Pickup and Delivery")) {
                            if (($("#pickupdate").val().length != 0) && ($("#pickupaddress").val().length != 0)) {
                                $("#productNextBtn").hide();
                                $("#productsection").hide();
                                $("#productsPrevBtn").hide();
                                $("#chargessection").fadeIn();
                                $("#chargesNextBtn").fadeIn();
                                $("#chargesPrevBtn").fadeIn();

                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                        }

                        if (($('input[name=pickupordelivery]:checked').val() == "Delivery Only")) {
                            $("#productNextBtn").hide();
                            $("#productsection").hide();
                            $("#productsPrevBtn").hide();
                            $("#chargessection").fadeIn();
                            $("#chargesNextBtn").fadeIn();
                            $("#chargesPrevBtn").fadeIn();

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }
                }
            }

            if (($('input[name=products]:checked').val() == "cbsl")) {
                if (($("#GB-RS-Track").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the parcel tracking number field empty!");
                }

                if (($("#GB-RS-Courier").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the courier field empty!");
                }

                if (($("#gbrsItemDescription").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the item description field empty!");
                }

                if (($("#GB-RS-Quantity").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the quantity field empty!");
                }

                if (($("#GB-RS-Total-Amount").val().length == 0)) {
                    $("#chargessection").hide();
                    alert("Please do not leave the total item price field empty!");
                }

                if (($('input[name=pickupordeliverycbsl]:checked').val() != undefined) && ($("#GB-RS-Track").val().length != 0) && ($("#GB-RS-Courier").val().length != 0)
                    && ($("#gbrsItemDescription").val().length != 0) && ($("#GB-RS-Quantity").val().length != 0)
                    && ($("#GB-RS-Total-Amount").val().length != 0)) {

                    if ($('input[name=pickupordeliverycbsl]:checked').val() == "pickup") {
                        $("#sectioncbslcharges").hide();

                    } else {
                        $("#sectioncbslcharges").fadeIn();
                    }

                    $("#productNextBtn").hide();
                    $("#productsection").hide();
                    $("#productsPrevBtn").hide();
                    $("#chargessection").fadeIn();
                    $("#chargesNextBtn").fadeIn();
                    $("#chargesPrevBtn").fadeIn();

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        });

        document.getElementById("chargesNextBtn").addEventListener("click", function () {
            if (($('input[name=products]:checked').val() == "pharmacymoh")) {
                if ($('input[name=mohCharges]:checked').val() == undefined) {
                    $("#agreementsection").hide();
                    alert("Please choose one of the charges!");
                }

                if ($('input[name=mohPayingPatient]:checked').val() == undefined) {
                    $("#agreementsection").hide();
                    alert("Please choose if you are a paying patient or not!");
                }

                if (($("#paymentmethod").val().length == 0)) {
                    $("#agreementsection").hide();
                    alert("Please choose your payment method!");
                }

                if (($('input[name=mohCharges]:checked').val() != undefined) && ($('input[name=mohPayingPatient]:checked').val() != undefined)
                    && ($("#paymentmethod").val().length != 0)) {
                    $("#chargesNextBtn").hide();
                    $("#chargessection").hide();
                    $("#chargesPrevBtn").hide();
                    $("#agreementsection").fadeIn();
                    $("#submitBtn").fadeIn();
                    $("#agreesubmitPrevBtn").fadeIn();
                    $("#ensure").hide();

                    document.getElementById("namesum").innerHTML = "Name: <b>" + document.getElementById("name").value + "</b>";
                    document.getElementById("addresssum").innerHTML = "Address: <b>" + document.getElementById("house").value + " " + document.getElementById("kampong").value
                        + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                        + document.getElementById("postal").value + "</b>";

                    if ($("#email").val().length == 0) {
                        document.getElementById("emailsum").innerHTML = "Email: <b>N/A</b>";
                    }

                    if ($("#email").val().length != 0) {
                        document.getElementById("emailsum").innerHTML = "Email: <b>" + document.getElementById("email").value + "</b>";
                    }

                    document.getElementById("contact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "") + "</b>";

                    if ($("#contact_2").val().length == 0) {
                        document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>N/A</b>";
                    }

                    if ($("#contact_2").val().length != 0) {
                        document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "") + "</b>";
                    }

                    document.getElementById("buyerName").value = "";
                    if (($('input[name=mohCharges]:checked').val() == "Standard")) {
                        document.getElementById('price').value = (4).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>2-3 Working Days</b>";
                    }

                    if (($('input[name=mohCharges]:checked').val() == "Express")) {
                        document.getElementById('price').value = (5.5).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Next Working Day</b>";
                    }

                    if (($('input[name=mohCharges]:checked').val() == "Immediate")) {
                        document.getElementById('price').value = (20).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Within 3 Hours</b>";
                    }
                    $("#deliveryDurationsum").fadeIn();
                    $("#productSumGRP").hide();
                    $("#productSumGD").hide();
                    $("#productSumPharmacy").fadeIn();
                    $("#chargeHeadingsum").fadeIn();
                    $("#productSumRS").hide();
                    document.getElementById("productssum").innerHTML = "Product Type: <b>MOH Pharmacy Order</b>";
                    document.getElementById("patientNumbersum").innerHTML = "Bru-HIMs Number: <b>" + document.getElementById("patientNumber").value + "</b>";
                    document.getElementById("dateofbirthsum").innerHTML = "Patient's Date of Birth: <b>" + document.getElementById("dateofbirth").value + "</b>";
                    document.getElementById("icnumberpassportsum").innerHTML = "IC-Number / Passport: <b>" + document.getElementById("icPassportNum").value + "</b>";
                    document.getElementById("healthcentresum").innerHTML = "Health Centre: <b>" + document.getElementById("healthCentreBM").value
                        + document.getElementById("healthCentreTTG").value + document.getElementById("healthCentreTEMB").value
                        + document.getElementById("healthCentreKB").value + "</b>";
                    $("#deliveryTypesum").fadeIn();
                    $("#amounttobepaidsum").fadeIn();
                    $("#pharmacyPPsum").fadeIn();
                    $("#paymentmethodsum").fadeIn();
                    document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>" + $('input[name=mohCharges]:checked').val() + "</b>";

                    if ($('input[name=mohPayingPatient]:checked').val() == 'No') {
                        document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND " + document.getElementById("price").value + "</b>";
                    } else {
                        document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND " + document.getElementById("price").value + " (excluding other charges)</b>";
                    }

                    document.getElementById("pharmacyPPsum").innerHTML = "Paying Patient?: <b>" + $('input[name=mohPayingPatient]:checked').val() + "</b>";
                    document.getElementById("paymentmethodsum").innerHTML = "Payment Method: <b>" + document.getElementById("paymentmethod").value + "</b>";

                    document.getElementById("remarkssum").innerHTML = "Remarks: <b>" + document.getElementById("remarks").value + "</b>";

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            if (($('input[name=products]:checked').val() == "pharmacyjpmc")) {
                if ($('input[name=jpmcCharges]:checked').val() == undefined) {
                    $("#agreementsection").hide();
                    alert("Please choose one of the charges!");
                }

                if ($('input[name=jpmcPayingPatient]:checked').val() == undefined) {
                    $("#agreementsection").hide();
                    alert("Please choose if you are a paying patient or not!");
                }

                if (($("#paymentmethod").val().length == 0)) {
                    $("#agreementsection").hide();
                    alert("Please choose your payment method!");
                }

                if (($('input[name=jpmcCharges]:checked').val() != undefined) && ($('input[name=jpmcPayingPatient]:checked').val() != undefined)
                    && ($("#paymentmethod").val().length != 0)) {
                    $("#chargesNextBtn").hide();
                    $("#chargessection").hide();
                    $("#chargesPrevBtn").hide();
                    $("#agreementsection").fadeIn();
                    $("#submitBtn").fadeIn();
                    $("#agreesubmitPrevBtn").fadeIn();
                    $("#ensure").hide();

                    document.getElementById("namesum").innerHTML = "Name: <b>" + document.getElementById("name").value + "</b>";
                    document.getElementById("addresssum").innerHTML = "Address: <b>" + document.getElementById("house").value + " " + document.getElementById("kampong").value
                        + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                        + document.getElementById("postal").value + "</b>";

                    if ($("#email").val().length == 0) {
                        document.getElementById("emailsum").innerHTML = "Email: <b>N/A</b>";
                    }

                    if ($("#email").val().length != 0) {
                        document.getElementById("emailsum").innerHTML = "Email: <b>" + document.getElementById("email").value + "</b>";
                    }

                    document.getElementById("contact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "") + "</b>";

                    if ($("#contact_2").val().length == 0) {
                        document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>N/A</b>";
                    }

                    if ($("#contact_2").val().length != 0) {
                        document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "") + "</b>";
                    }

                    document.getElementById("buyerName").value = "";
                    if (($('input[name=jpmcCharges]:checked').val() == "Express Brunei-Muara")) {
                        document.getElementById('price').value = (5.5).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Next Working Day</b>";
                    }

                    if (($('input[name=jpmcCharges]:checked').val() == "Standard Brunei-Muara")) {
                        document.getElementById('price').value = (4).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>2-3 Working Days</b>";
                    }

                    if (($('input[name=jpmcCharges]:checked').val() == "Standard Tutong")) {
                        document.getElementById('price').value = (8).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>2-3 Working Days</b>";
                    }

                    if (($('input[name=jpmcCharges]:checked').val() == "Standard Belait")) {
                        document.getElementById('price').value = (8).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>2-3 Working Days</b>";
                    }

                    if (($('input[name=jpmcCharges]:checked').val() == "Standard Temburong")) {
                        document.getElementById('price').value = (11).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>2-3 Working Days</b>";
                    }
                    $("#deliveryDurationsum").fadeIn();
                    $("#productSumGRP").hide();
                    $("#productSumGD").hide();
                    $("#productSumPharmacy").fadeIn();
                    $("#productSumRS").hide();
                    document.getElementById("productssum").innerHTML = "Product Type: <b>JPMC / PJSC Pharmacy Order</b>";
                    document.getElementById("patientNumbersum").innerHTML = "Patient's Number: <b>" + document.getElementById("patientNumber").value + "</b>";
                    document.getElementById("dateofbirthsum").innerHTML = "Patient's Date of Birth: <b>" + document.getElementById("dateofbirth").value + "</b>";
                    document.getElementById("icnumberpassportsum").innerHTML = "IC-Number / Passport: <b>" + document.getElementById("icPassportNum").value + "</b>";
                    document.getElementById("healthcentresum").innerHTML = "Health Centre: <b>" + $('input[name=jpmcpjsc]:checked').val() + "</b>";
                    $("#deliveryTypesum").fadeIn();
                    $("#amounttobepaidsum").fadeIn();
                    $("#pharmacyPPsum").fadeIn();
                    $("#paymentmethodsum").fadeIn();
                    $("#chargeHeadingsum").fadeIn();
                    document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>" + $('input[name=jpmcCharges]:checked').val() + "</b>";
                    document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND" + document.getElementById("price").value + "</b>";
                    document.getElementById("pharmacyPPsum").innerHTML = "Paying Patient?: <b>" + $('input[name=jpmcPayingPatient]:checked').val() + "</b>";
                    document.getElementById("paymentmethodsum").innerHTML = "Payment Method: <b>" + document.getElementById("paymentmethod").value + "</b>";

                    document.getElementById("remarkssum").innerHTML = "Remarks: <b>" + document.getElementById("remarks").value + "</b>";

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            if (($('input[name=products]:checked').val() == "pharmacyphc")) {
                if ($('input[name=phcCharges]:checked').val() == undefined) {
                    $("#agreementsection").hide();
                    alert("Please choose one of the charges!");
                }

                if ($('input[name=phcPayingPatient]:checked').val() == undefined) {
                    $("#agreementsection").hide();
                    alert("Please choose if you are a paying patient or not!");
                }

                if (($("#paymentmethod").val().length == 0)) {
                    $("#agreementsection").hide();
                    alert("Please choose your payment method!");
                }

                if (($('input[name=phcCharges]:checked').val() != undefined) && ($('input[name=phcPayingPatient]:checked').val() != undefined)
                    && ($("#paymentmethod").val().length != 0)) {
                    $("#chargesNextBtn").hide();
                    $("#chargessection").hide();
                    $("#chargesPrevBtn").hide();
                    $("#agreementsection").fadeIn();
                    $("#submitBtn").fadeIn();
                    $("#agreesubmitPrevBtn").fadeIn();
                    $("#ensure").hide();

                    document.getElementById("namesum").innerHTML = "Name: <b>" + document.getElementById("name").value + "</b>";
                    document.getElementById("addresssum").innerHTML = "Address: <b>" + document.getElementById("house").value + " " + document.getElementById("kampong").value
                        + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                        + document.getElementById("postal").value + "</b>";

                    if ($("#email").val().length == 0) {
                        document.getElementById("emailsum").innerHTML = "Email: <b>N/A</b>";
                    }

                    if ($("#email").val().length != 0) {
                        document.getElementById("emailsum").innerHTML = "Email: <b>" + document.getElementById("email").value + "</b>";
                    }

                    document.getElementById("contact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "") + "</b>";

                    if ($("#contact_2").val().length == 0) {
                        document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>N/A</b>";
                    }

                    if ($("#contact_2").val().length != 0) {
                        document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "") + "</b>";
                    }

                    document.getElementById("buyerName").value = "";
                    if (($('input[name=phcCharges]:checked').val() == "Standard Belait")) {
                        document.getElementById('price').value = (3).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Same Day</b>";
                    }

                    if (($('input[name=phcCharges]:checked').val() == "Standard Tutong")) {
                        document.getElementById('price').value = (5).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Same Day</b>";
                    }

                    if (($('input[name=phcCharges]:checked').val() == "Standard Brunei-Muara")) {
                        document.getElementById('price').value = (7).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Same Day</b>";
                    }

                    if (($('input[name=phcCharges]:checked').val() == "Standard Temburong")) {
                        document.getElementById('price').value = (10).toFixed(2);
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Same Day</b>";
                    }
                    $("#deliveryDurationsum").fadeIn();
                    $("#productSumGRP").hide();
                    $("#productSumGD").hide();
                    $("#productSumPharmacy").fadeIn();
                    $("#productSumRS").hide();
                    document.getElementById("productssum").innerHTML = "Product Type: <b>Panaga Health Pharmacy Order</b>";
                    document.getElementById("patientNumbersum").innerHTML = "Patient's Number: <b>" + document.getElementById("patientNumber").value + "</b>";
                    document.getElementById("dateofbirthsum").innerHTML = "Patient's Date of Birth: <b>" + document.getElementById("dateofbirth").value + "</b>";
                    document.getElementById("icnumberpassportsum").innerHTML = "IC-Number / Passport: <b>" + document.getElementById("icPassportNum").value + "</b>";
                    document.getElementById("healthcentresum").innerHTML = "Health Centre: <b>Panaga Health</b>";
                    $("#deliveryTypesum").fadeIn();
                    $("#amounttobepaidsum").fadeIn();
                    $("#pharmacyPPsum").fadeIn();
                    $("#paymentmethodsum").fadeIn();
                    $("#chargeHeadingsum").fadeIn();
                    document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>" + $('input[name=phcCharges]:checked').val() + "</b>";
                    document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND " + document.getElementById("price").value + "</b>";
                    document.getElementById("pharmacyPPsum").innerHTML = "Paying Patient?: <b>" + $('input[name=phcPayingPatient]:checked').val() + "</b>";
                    document.getElementById("paymentmethodsum").innerHTML = "Payment Method: <b>" + document.getElementById("paymentmethod").value + "</b>";

                    document.getElementById("remarkssum").innerHTML = "Remarks: <b>" + document.getElementById("remarks").value + "</b>";

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            if (($('input[name=products]:checked').val() == "grp")) {
                if (($("#paymentmethod").val().length == 0)) {
                    $("#agreementsection").hide();
                    alert("Please choose your payment method!");
                }

                if ($('input[name=grpCharges]:checked').val() == undefined) {
                    if ($('input[name=pickupordeliverygrp]:checked').val() == "delivery") {
                        $("#agreementsection").hide();
                        alert("Please choose one of the charges!");
                    }
                }

                if ($("#paymentmethod").val().length != 0) {
                    if ($('input[name=pickupordeliverygrp]:checked').val() == "delivery") {
                        if ($('input[name=grpCharges]:checked').val() != undefined) {
                            $("#chargesNextBtn").hide();
                            $("#chargessection").hide();
                            $("#chargesPrevBtn").hide();
                            $("#agreementsection").fadeIn();
                            $("#submitBtn").fadeIn();
                            $("#agreesubmitPrevBtn").fadeIn();
                            $("#ensure").hide();

                            document.getElementById("namesum").innerHTML = "Name: <b>" + document.getElementById("name").value + "</b>";
                            document.getElementById("addresssum").innerHTML = "Address: <b>" + document.getElementById("house").value + " " + document.getElementById("kampong").value
                                + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                                + document.getElementById("postal").value + "</b>";

                            if ($("#email").val().length == 0) {
                                document.getElementById("emailsum").innerHTML = "Email: <b>N/A</b>";
                            }

                            if ($("#email").val().length != 0) {
                                document.getElementById("emailsum").innerHTML = "Email: <b>" + document.getElementById("email").value + "</b>";
                            }

                            document.getElementById("contact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code").value + document.getElementById("contact_1").value + "</b>";

                            if ($("#contact_2").val().length == 0) {
                                document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>N/A</b>";
                            }

                            if ($("#contact_2").val().length != 0) {
                                document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>+" + document.getElementById("code_2").value + document.getElementById("contact_2").value + "</b>";
                            }

                            document.getElementById("pickupordeliverysum").innerHTML = "Pickup or Delivery?: <b>" + $('input[name=pickupordeliverycbsl]:checked').val() + "</b>";

                            $("#deliveryDurationsum").hide();
                            var codeN = "/GRP";
                            var conN = document.getElementById("name").value;
                            document.getElementById("buyerName").value = conN + codeN;
                            document.getElementById('price').value = '';
                            $("#productSumGRP").fadeIn();
                            $("#productSumGD").hide();
                            $("#productSumPharmacy").hide();
                            $("#productSumRS").hide();
                            document.getElementById("productssum").innerHTML = "Product Type: <b>Go Rush Plus</b>";
                            document.getElementById("grpTracksum").innerHTML = "Parcel Tracking Number: <b>" + document.getElementById("grpTrack").value + "</b>";
                            document.getElementById("GoRushReceivingCountrysum").innerHTML = "Go Rush Receiving Country: <b>" + document.getElementById("GoRushReceivingCountry").value + "</b>";
                            document.getElementById("shipmentMethodsum").innerHTML = "Shipment Method: <b>" + $('input[name=shipmentMethod]:checked').val() + "</b>";
                            document.getElementById("ecommercesum").innerHTML = "E-Commerce Name: <b>" + document.getElementById("ecommerce").value + "</b>";
                            document.getElementById("commoditiessum").innerHTML = "Commodities: <b>" + document.getElementById("commodities").value + "</b>";
                            document.getElementById("currencysum").innerHTML = "Currency: <b>" + document.getElementById("currency").value + "</b>";
                            document.getElementById("weightsum").innerHTML = "Weight (KG): <b>" + document.getElementById("weight").value + "</b>";
                            document.getElementById("permitsum").innerHTML = "Permit Application?: <b>" + $('input[name=permit]:checked').val() + "</b>";
                            document.getElementById("itemContainssum").innerHTML = "Does your item contains one of the following?: <b>" + $('input[name=itemContains]:checked').val() + "</b>";
                            document.getElementById("itemPricesum").innerHTML = "Total Price: <b>" + document.getElementById("currency").value + ' ' + document.getElementById("itemPrice").value + "</b>";
                            document.getElementById("paymentmethodsum").innerHTML = "Payment Method: <b>" + document.getElementById("paymentmethod").value + "</b>";
                            $("#deliveryTypesum").fadeIn();
                            $("#pharmacyPPsum").hide();
                            $("#paymentmethodsum").fadeIn();
                            $("#chargeHeadingsum").hide();

                            document.getElementById("remarkssum").innerHTML = "Remarks: <b>" + document.getElementById("remarks").value + "</b>";

                            if (($('input[name=pickupordeliverygrp]:checked').val() == "pickup")) {
                                $("#amounttobepaidsum").hide();
                                document.getElementById("price").value = 0
                                document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>Pickup</b>";
                            } else {
                                if (($('input[name=grpCharges]:checked').val() == "Immediate Brunei Muara")) {
                                    document.getElementById("price").value = (20).toFixed(2)
                                }

                                if (($('input[name=grpCharges]:checked').val() == "Drop off Brunei Muara")) {
                                    document.getElementById("price").value = (4).toFixed(2)
                                }

                                if (($('input[name=grpCharges]:checked').val() == "Drop off Tutong")) {
                                    document.getElementById("price").value = (6).toFixed(2)
                                }

                                if (($('input[name=grpCharges]:checked').val() == "Drop off Belait")) {
                                    document.getElementById("price").value = (8).toFixed(2)
                                }

                                if (($('input[name=grpCharges]:checked').val() == "Drop off Temburong")) {
                                    document.getElementById("price").value = (11).toFixed(2)
                                }
                                document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>" + $('input[name=grpCharges]:checked').val() + "</b>";
                                $("#amounttobepaidsum").fadeIn();
                            }

                            document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND " + document.getElementById("price").value + " (excluding other charges)</b>";

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }

                    if ($('input[name=pickupordeliverygrp]:checked').val() == "pickup") {
                        $("#chargesNextBtn").hide();
                        $("#chargessection").hide();
                        $("#chargesPrevBtn").hide();
                        $("#agreementsection").fadeIn();
                        $("#submitBtn").fadeIn();
                        $("#agreesubmitPrevBtn").fadeIn();
                        $("#ensure").hide();

                        document.getElementById("namesum").innerHTML = "Name: <b>" + document.getElementById("name").value + "</b>";
                        document.getElementById("addresssum").innerHTML = "Address: <b>" + document.getElementById("house").value + " " + document.getElementById("kampong").value
                            + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                            + document.getElementById("postal").value + "</b>";

                        if ($("#email").val().length == 0) {
                            document.getElementById("emailsum").innerHTML = "Email: <b>N/A</b>";
                        }

                        if ($("#email").val().length != 0) {
                            document.getElementById("emailsum").innerHTML = "Email: <b>" + document.getElementById("email").value + "</b>";
                        }

                        document.getElementById("contact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code").value + document.getElementById("contact_1").value + "</b>";

                        if ($("#contact_2").val().length == 0) {
                            document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>N/A</b>";
                        }

                        if ($("#contact_2").val().length != 0) {
                            document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>+" + document.getElementById("code_2").value + document.getElementById("contact_2").value + "</b>";
                        }

                        document.getElementById("pickupordeliverysum").innerHTML = "Pickup or Delivery?: <b>" + $('input[name=pickupordeliverycbsl]:checked').val() + "</b>";

                        $("#deliveryDurationsum").hide();
                        var codeN = "/GRP";
                        var conN = document.getElementById("name").value;
                        document.getElementById("buyerName").value = conN + codeN;
                        document.getElementById('price').value = '';
                        $("#productSumGRP").fadeIn();
                        $("#productSumGD").hide();
                        $("#productSumPharmacy").hide();
                        $("#productSumRS").hide();
                        document.getElementById("productssum").innerHTML = "Product Type: <b>Go Rush Plus</b>";
                        document.getElementById("grpTracksum").innerHTML = "Parcel Tracking Number: <b>" + document.getElementById("grpTrack").value + "</b>";
                        document.getElementById("GoRushReceivingCountrysum").innerHTML = "Go Rush Receiving Country: <b>" + document.getElementById("GoRushReceivingCountry").value + "</b>";
                        document.getElementById("shipmentMethodsum").innerHTML = "Shipment Method: <b>" + $('input[name=shipmentMethod]:checked').val() + "</b>";
                        document.getElementById("ecommercesum").innerHTML = "E-Commerce Name: <b>" + document.getElementById("ecommerce").value + "</b>";
                        document.getElementById("commoditiessum").innerHTML = "Commodities: <b>" + document.getElementById("commodities").value + "</b>";
                        document.getElementById("currencysum").innerHTML = "Currency: <b>" + document.getElementById("currency").value + "</b>";
                        document.getElementById("weightsum").innerHTML = "Weight (KG): <b>" + document.getElementById("weight").value + "</b>";
                        document.getElementById("permitsum").innerHTML = "Permit Application?: <b>" + $('input[name=permit]:checked').val() + "</b>";
                        document.getElementById("itemContainssum").innerHTML = "Does your item contains one of the following?: <b>" + $('input[name=itemContains]:checked').val() + "</b>";
                        document.getElementById("itemPricesum").innerHTML = "Total Price: <b>" + document.getElementById("currency").value + ' ' + document.getElementById("itemPrice").value + "</b>";
                        document.getElementById("paymentmethodsum").innerHTML = "Payment Method: <b>" + document.getElementById("paymentmethod").value + "</b>";
                        $("#deliveryTypesum").fadeIn();
                        $("#pharmacyPPsum").hide();
                        $("#paymentmethodsum").fadeIn();
                        $("#chargeHeadingsum").hide();

                        document.getElementById("remarkssum").innerHTML = "Remarks: <b>" + document.getElementById("remarks").value + "</b>";

                        if (($('input[name=pickupordeliverygrp]:checked').val() == "pickup")) {
                            $("#amounttobepaidsum").hide();
                            document.getElementById("price").value = 0
                            document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>Pickup</b>";
                        } else {
                            if (($('input[name=grpCharges]:checked').val() == "Immediate Brunei Muara")) {
                                document.getElementById("price").value = (20).toFixed(2)
                            }

                            if (($('input[name=grpCharges]:checked').val() == "Drop off Brunei Muara")) {
                                document.getElementById("price").value = (4).toFixed(2)
                            }

                            if (($('input[name=grpCharges]:checked').val() == "Drop off Tutong")) {
                                document.getElementById("price").value = (6).toFixed(2)
                            }

                            if (($('input[name=grpCharges]:checked').val() == "Drop off Belait")) {
                                document.getElementById("price").value = (8).toFixed(2)
                            }

                            if (($('input[name=grpCharges]:checked').val() == "Drop off Temburong")) {
                                document.getElementById("price").value = (11).toFixed(2)
                            }
                            document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>" + $('input[name=grpCharges]:checked').val() + "</b>";
                            $("#amounttobepaidsum").fadeIn();
                        }

                        document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND " + document.getElementById("price").value + " (excluding other charges)</b>";

                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
            }

            if (($('input[name=products]:checked').val() == "localdelivery")) {
                if ($('input[name=localCharges]:checked').val() == undefined) {
                    $("#agreementsection").hide();
                    alert("Please choose one of the charges!");
                }

                if (($("#billto").val().length == 0)) {
                    $("#agreementsection").hide();
                    alert("Please choose for billing to sender or receiver!");
                }

                if (($("#paymentmethod").val().length == 0)) {
                    $("#agreementsection").hide();
                    alert("Please choose who to bill!");
                }

                if (($('input[name=localCharges]:checked').val() != undefined) && ($("#billto").val().length != 0)
                    && ($("#paymentmethod").val().length != 0)) {
                    $("#chargesNextBtn").hide();
                    $("#chargessection").hide();
                    $("#chargesPrevBtn").hide();
                    $("#agreementsection").fadeIn();
                    $("#submitBtn").fadeIn();
                    $("#agreesubmitPrevBtn").fadeIn();
                    $("#ensure").hide();

                    document.getElementById("namesum").innerHTML = "Name: <b>" + document.getElementById("name").value + "</b>";
                    document.getElementById("addresssum").innerHTML = "Address: <b>" + document.getElementById("house").value + " " + document.getElementById("kampong").value
                        + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                        + document.getElementById("postal").value + "</b>";

                    if ($("#email").val().length == 0) {
                        document.getElementById("emailsum").innerHTML = "Email: <b>N/A</b>";
                    }

                    if ($("#email").val().length != 0) {
                        document.getElementById("emailsum").innerHTML = "Email: <b>" + document.getElementById("email").value + "</b>";
                    }

                    document.getElementById("contact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "") + "</b>";

                    if ($("#contact_2").val().length == 0) {
                        document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>N/A</b>";
                    }

                    if ($("#contact_2").val().length != 0) {
                        document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "") + "</b>";
                    }

                    document.getElementById("buyerName").value = "";
                    if (($('input[name=localCharges]:checked').val() == "Standard Brunei-Muara")) {
                        if (document.getElementById("productweight").value <= 3) {
                            document.getElementById("price").value = (5).toFixed(2)
                        } else {
                            document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 5).toFixed(2)
                        }
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Next Day Delivery</b>";
                        $("#deliveryDurationsum").fadeIn();
                    }

                    if (($('input[name=localCharges]:checked').val() == "Standard Tutong")) {
                        if (document.getElementById("productweight").value <= 3) {
                            document.getElementById("price").value = (8).toFixed(2)
                        } else {
                            document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 8).toFixed(2)
                        }
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Next Day Delivery</b>";
                        $("#deliveryDurationsum").fadeIn();
                    }

                    if (($('input[name=localCharges]:checked').val() == "Standard Belait")) {
                        if (document.getElementById("productweight").value <= 3) {
                            document.getElementById("price").value = (15).toFixed(2)
                        } else {
                            document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 15).toFixed(2)
                        }
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Next Day Delivery</b>";
                        $("#deliveryDurationsum").fadeIn();
                    }

                    if (($('input[name=localCharges]:checked').val() == "Standard Temburong")) {
                        if (document.getElementById("productweight").value <= 3) {
                            document.getElementById("price").value = (15).toFixed(2)
                        } else {
                            document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 15).toFixed(2)
                        }
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Next Day Delivery</b>";
                        $("#deliveryDurationsum").fadeIn();
                    }

                    if (($('input[name=localCharges]:checked').val() == "Express Brunei Muara")) {
                        if (document.getElementById("productweight").value <= 3) {
                            document.getElementById("price").value = (7).toFixed(2)
                        } else {
                            document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 7).toFixed(2)
                        }
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Same Day Delivery</b>";
                        $("#deliveryDurationsum").fadeIn();
                    }

                    if (($('input[name=localCharges]:checked').val() == "Drop off Brunei Muara")) {
                        if (document.getElementById("productweight").value <= 3) {
                            document.getElementById("price").value = (4).toFixed(2)
                        } else {
                            document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 4).toFixed(2)
                        }
                        $("#deliveryDurationsum").hide();
                    }

                    if (($('input[name=localCharges]:checked').val() == "Drop off Tutong")) {
                        if (document.getElementById("productweight").value <= 3) {
                            document.getElementById("price").value = (6).toFixed(2)
                        } else {
                            document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 6).toFixed(2)
                        }
                        $("#deliveryDurationsum").hide();
                    }

                    if (($('input[name=localCharges]:checked').val() == "Drop off Belait")) {
                        if (document.getElementById("productweight").value <= 3) {
                            document.getElementById("price").value = (8).toFixed(2)
                        } else {
                            document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 8).toFixed(2)
                        }
                        $("#deliveryDurationsum").hide();
                    }

                    if (($('input[name=localCharges]:checked').val() == "Express Joybean")) {
                        document.getElementById("price").value = (6).toFixed(2)
                        document.getElementById("deliveryDurationsum").innerHTML = "Delivery Duration: <b>Same Day Delivery</b>";
                        $("#deliveryDurationsum").fadeIn();
                    }

                    $("#productSumGRP").hide();
                    $("#productSumGD").fadeIn();
                    $("#productSumPharmacy").hide();
                    $("#productSumRS").hide();
                    document.getElementById("productssum").innerHTML = "Product Type: <b>Local Delivery</b>";
                    document.getElementById("pickupordeliverysum").innerHTML = "Pickup or Delivery?: <b>" + $('input[name=pickupordelivery]:checked').val() + "</b>";

                    if (($('input[name=pickupordelivery]:checked').val() == "Delivery Only")) {
                        document.getElementById("pickupdatesum").innerHTML = "Pick-Up Date: <b>N/A</b>";
                        document.getElementById("pickupaddresssum").innerHTML = "Pick-Up Address: <b>N/A</b>";
                    }

                    if (($('input[name=pickupordelivery]:checked').val() == "Pickup and Delivery")) {
                        document.getElementById("pickupdatesum").innerHTML = "Pick-Up Date: <b>" + document.getElementById("pickupdate").value + "</b>";
                        document.getElementById("pickupaddresssum").innerHTML = "Pick-Up Address: <b>" + document.getElementById("pickupaddress").value + "</b>";
                    }

                    document.getElementById("productdescriptionsum").innerHTML = "Product Description: <b>" + document.getElementById("productdescription").value + "</b>";
                    document.getElementById("producttypesum").innerHTML = "Product Type: <b>" + document.getElementById("producttype").value + "</b>";
                    document.getElementById("productweightsum").innerHTML = "Product Weight: <b>N/A</b>";
                    document.getElementById("receiverNamesum").innerHTML = "Name: <b>" + document.getElementById("receiverName").value + "</b>";
                    document.getElementById("receiverAddresssum").innerHTML = "Address: <b>" + document.getElementById("receiverHouse").value + " " + document.getElementById("receiverKampong").value
                        + " " + document.getElementById("receiverJalan").value + " " + document.getElementById("receiverSimpang").value + " " + $('input[name=receiverDistrict]:checked').val() + " "
                        + document.getElementById("receiverPostal").value + "</b>";
                    document.getElementById("receiverEmailsum").innerHTML = "E-mail: <b>" + document.getElementById("receiverEmail").value + "</b>";
                    document.getElementById("receiverContact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code_3").value + document.getElementById("receiverContact_1").value + "</b>";
                    $("#deliveryTypesum").fadeIn();
                    $("#amounttobepaidsum").fadeIn();
                    $("#pharmacyPPsum").hide();
                    $("#paymentmethodsum").fadeIn();
                    $("#chargeHeadingsum").fadeIn();
                    document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>" + $('input[name=localCharges]:checked').val() + "</b>";
                    document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND " + document.getElementById("price").value + "</b>";
                    document.getElementById("billTosum").innerHTML = "Bill to: <b>" + document.getElementById("billto").value + "</b>";
                    document.getElementById("paymentmethodsum").innerHTML = "Payment Method: <b>" + document.getElementById("paymentmethod").value + "</b>";

                    document.getElementById("remarkssum").innerHTML = "Remarks: <b>" + document.getElementById("remarks").value + "</b>";

                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }

            if (($('input[name=products]:checked').val() == "cbsl")) {
                if (($("#paymentmethod").val().length == 0)) {
                    $("#agreementsection").hide();
                    alert("Please choose your payment method!");
                }

                if ($('input[name=cbslCharges]:checked').val() == undefined) {
                    if ($('input[name=pickupordeliverycbsl]:checked').val() == "delivery") {
                        $("#agreementsection").hide();
                        alert("Please choose one of the charges!");
                    }
                }

                if ($("#paymentmethod").val().length != 0) {
                    if ($('input[name=pickupordeliverycbsl]:checked').val() == "delivery") {
                        if ($('input[name=cbslCharges]:checked').val() != undefined) {
                            $("#chargesNextBtn").hide();
                            $("#chargessection").hide();
                            $("#chargesPrevBtn").hide();
                            $("#agreementsection").fadeIn();
                            $("#submitBtn").fadeIn();
                            $("#agreesubmitPrevBtn").fadeIn();
                            $("#ensure").hide();

                            document.getElementById("namesum").innerHTML = "Name: <b>" + document.getElementById("name").value + "</b>";
                            document.getElementById("addresssum").innerHTML = "Address: <b>" + document.getElementById("house").value + " " + document.getElementById("kampong").value
                                + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                                + document.getElementById("postal").value + "</b>";

                            if ($("#email").val().length == 0) {
                                document.getElementById("emailsum").innerHTML = "Email: <b>N/A</b>";
                            }

                            if ($("#email").val().length != 0) {
                                document.getElementById("emailsum").innerHTML = "Email: <b>" + document.getElementById("email").value + "</b>";
                            }

                            document.getElementById("contact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "") + "</b>";

                            if ($("#contact_2").val().length == 0) {
                                document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>N/A</b>";
                            }

                            if ($("#contact_2").val().length != 0) {
                                document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "") + "</b>";
                            }

                            $("#deliveryDurationsum").hide();
                            var codeN = "/GobeliStore";
                            var conN = document.getElementById("name").value;
                            document.getElementById("buyerName").value = conN + codeN;
                            document.getElementById('price').value = '';
                            $("#productSumGRP").hide();
                            $("#productSumGD").hide();
                            $("#productSumPharmacy").hide();
                            $("#productSumRS").fadeIn();
                            document.getElementById("productssum").innerHTML = "Product Type: <b>Go Beli Cross Border Service (Limbang)</b>";
                            document.getElementById("gbrsTracksum").innerHTML = "Original Tracking Number: <b>" + document.getElementById("GB-RS-Track").value + "</b>";
                            document.getElementById("gbrsCouriersum").innerHTML = "Courier: <b>" + document.getElementById("GB-RS-Courier").value + "</b>";
                            document.getElementById("gbrsItemDescsum").innerHTML = "Item Description: <b>" + document.getElementById("gbrsItemDescription").value + "</b>";
                            document.getElementById("gbrsTotalAmountsum").innerHTML = "Total Amount: <b>MYR " + document.getElementById("GB-RS-Total-Amount").value + "</b>";
                            document.getElementById("gbrsQuantitysum").innerHTML = "Quantity: <b>" + document.getElementById("GB-RS-Quantity").value + "</b>";
                            document.getElementById("paymentmethodsum").innerHTML = "Payment Method: <b>" + document.getElementById("paymentmethod").value + "</b>";
                            $("#deliveryTypesum").fadeIn();
                            $("#pharmacyPPsum").hide();
                            $("#paymentmethodsum").fadeIn();
                            $("#chargeHeadingsum").hide();

                            if (($('input[name=pickupordeliverycbsl]:checked').val() == "pickup")) {
                                $("#amounttobepaidsum").hide();
                                document.getElementById("price").value = 0
                                document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>Pickup</b>";
                            } else {
                                if (($('input[name=cbslCharges]:checked').val() == "Immediate Brunei Muara")) {
                                    document.getElementById("price").value = (20).toFixed(2)
                                }

                                if (($('input[name=cbslCharges]:checked').val() == "Drop off Brunei Muara")) {
                                    document.getElementById("price").value = (4).toFixed(2)
                                }

                                if (($('input[name=cbslCharges]:checked').val() == "Drop off Tutong")) {
                                    document.getElementById("price").value = (6).toFixed(2)
                                }

                                if (($('input[name=cbslCharges]:checked').val() == "Drop off Belait")) {
                                    document.getElementById("price").value = (8).toFixed(2)
                                }

                                if (($('input[name=cbslCharges]:checked').val() == "Drop off Temburong")) {
                                    document.getElementById("price").value = (11).toFixed(2)
                                }
                                document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>" + $('input[name=cbslCharges]:checked').val() + "</b>";
                                $("#amounttobepaidsum").fadeIn();
                            }

                            document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND " + document.getElementById("price").value + " (excluding other charges)</b>";

                            document.getElementById("remarkssum").innerHTML = "Remarks: <b>" + document.getElementById("remarks").value + "</b>";

                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }

                    if ($('input[name=pickupordeliverycbsl]:checked').val() == "pickup") {
                        $("#chargesNextBtn").hide();
                        $("#chargessection").hide();
                        $("#chargesPrevBtn").hide();
                        $("#agreementsection").fadeIn();
                        $("#submitBtn").fadeIn();
                        $("#agreesubmitPrevBtn").fadeIn();
                        $("#ensure").hide();

                        document.getElementById("namesum").innerHTML = "Name: <b>" + document.getElementById("name").value + "</b>";
                        document.getElementById("addresssum").innerHTML = "Address: <b>" + document.getElementById("house").value + " " + document.getElementById("kampong").value
                            + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                            + document.getElementById("postal").value + "</b>";

                        if ($("#email").val().length == 0) {
                            document.getElementById("emailsum").innerHTML = "Email: <b>N/A</b>";
                        }

                        if ($("#email").val().length != 0) {
                            document.getElementById("emailsum").innerHTML = "Email: <b>" + document.getElementById("email").value + "</b>";
                        }

                        document.getElementById("contact_1sum").innerHTML = "Phone Number: <b>+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "") + "</b>";

                        if ($("#contact_2").val().length == 0) {
                            document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>N/A</b>";
                        }

                        if ($("#contact_2").val().length != 0) {
                            document.getElementById("contact_2sum").innerHTML = "Additional Phone Number: <b>+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "") + "</b>";
                        }

                        $("#deliveryDurationsum").hide();
                        var codeN = "/GobeliStore";
                        var conN = document.getElementById("name").value;
                        document.getElementById("buyerName").value = conN + codeN;
                        document.getElementById('price').value = '';
                        $("#productSumGRP").hide();
                        $("#productSumGD").hide();
                        $("#productSumPharmacy").hide();
                        $("#productSumRS").fadeIn();
                        document.getElementById("productssum").innerHTML = "Product Type: <b>Go Beli Cross Border Service (Limbang)</b>";
                        document.getElementById("gbrsTracksum").innerHTML = "Original Tracking Number: <b>" + document.getElementById("GB-RS-Track").value + "</b>";
                        document.getElementById("gbrsCouriersum").innerHTML = "Courier: <b>" + document.getElementById("GB-RS-Courier").value + "</b>";
                        document.getElementById("gbrsItemDescsum").innerHTML = "Item Description: <b>" + document.getElementById("gbrsItemDescription").value + "</b>";
                        document.getElementById("gbrsTotalAmountsum").innerHTML = "Total Amount: <b>MYR " + document.getElementById("GB-RS-Total-Amount").value + "</b>";
                        document.getElementById("gbrsQuantitysum").innerHTML = "Quantity: <b>" + document.getElementById("GB-RS-Quantity").value + "</b>";
                        document.getElementById("paymentmethodsum").innerHTML = "Payment Method: <b>" + document.getElementById("paymentmethod").value + "</b>";
                        $("#deliveryTypesum").fadeIn();
                        $("#pharmacyPPsum").hide();
                        $("#paymentmethodsum").fadeIn();
                        $("#chargeHeadingsum").hide();

                        if (($('input[name=pickupordeliverycbsl]:checked').val() == "pickup")) {
                            $("#amounttobepaidsum").hide();
                            document.getElementById("price").value = 0
                            document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>Pickup</b>";
                        } else {
                            if (($('input[name=cbslCharges]:checked').val() == "Immediate Brunei Muara")) {
                                document.getElementById("price").value = (20).toFixed(2)
                            }

                            if (($('input[name=cbslCharges]:checked').val() == "Drop off Brunei Muara")) {
                                document.getElementById("price").value = (4).toFixed(2)
                            }

                            if (($('input[name=cbslCharges]:checked').val() == "Drop off Tutong")) {
                                document.getElementById("price").value = (6).toFixed(2)
                            }

                            if (($('input[name=cbslCharges]:checked').val() == "Drop off Belait")) {
                                document.getElementById("price").value = (8).toFixed(2)
                            }

                            if (($('input[name=cbslCharges]:checked').val() == "Drop off Temburong")) {
                                document.getElementById("price").value = (11).toFixed(2)
                            }
                            document.getElementById("deliveryTypesum").innerHTML = "Delivery Type: <b>" + $('input[name=cbslCharges]:checked').val() + "</b>";
                            $("#amounttobepaidsum").fadeIn();
                        }

                        document.getElementById("amounttobepaidsum").innerHTML = "Amount to be paid: <b>BND " + document.getElementById("price").value + " (excluding other charges)</b>";

                        document.getElementById("remarkssum").innerHTML = "Remarks: <b>" + document.getElementById("remarks").value + "</b>";

                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
            }
        });

        document.getElementById("productsPrevBtn").addEventListener("click", function () {
            $("#productsPrevBtn").hide();
            $("#productNextBtn").hide();
            $("#productsection").hide();
            $("#productselectionsection").fadeIn();
            $("#personalsection").fadeIn();
            $("#personalNextBtn").fadeIn();

            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.getElementById("chargesPrevBtn").addEventListener("click", function () {
            $("#chargesPrevBtn").hide();
            $("#chargesNextBtn").hide();
            $("#chargessection").hide();
            $("#productsection").fadeIn();
            $("#productNextBtn").fadeIn();
            $("#productsPrevBtn").fadeIn();

            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.getElementById("agreesubmitPrevBtn").addEventListener("click", function () {
            $("#chargesPrevBtn").fadeIn();
            $("#chargesNextBtn").fadeIn();
            $("#chargessection").fadeIn();
            $("#agreementsection").hide();
            $("#agreesubmitPrevBtn").hide();
            $("#submitBtn").hide();
            $("#ensure").fadeIn();

            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.getElementById("submitBtn").addEventListener("click", function () {
            $("#agreementsection").hide();
            $("#controlarea").hide();
            $("#loading").fadeIn();

            document.getElementById("customerthank").innerText = "Thank you " + document.getElementById("name").value + "!";
            document.getElementById("finalsummaryarea").innerHTML = document.getElementById("finalsummary").innerHTML;

            document.getElementById("dateSubmitted").value = moment().format('DD-MM-YYYY h:mm a');

            document.getElementById("finalsubmitteddate").innerText = moment().format('Do MMMM YYYY, h:mm a');

            document.getElementById("creationDate").value = moment().format('YYYY-MM-DD');

            document.getElementById("qbCreationDate").value = moment().format('DD/MM/YYYY');

            if ($('input[name=products]:checked').val() == "pharmacymoh") {
                document.getElementById("receiverName").value = document.getElementById("name").value;
                document.getElementById("receiverEmail").value = document.getElementById("email").value;
                document.getElementById("receiverPhone").value = document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("productdescription").value = "Medicine";
                document.getElementById("itemQuantity").value = "1";

                let area = "";

                let customerAddress = document.getElementById("house").value + " " + document.getElementById("kampong").value
                    + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                    + document.getElementById("postal").value;

                document.getElementById("receiverAddress").value = customerAddress;
                document.getElementById("customerAddress").value = customerAddress;

                let address = customerAddress.toUpperCase();
                var kampong = "";

                if (address.includes("MANGGIS") == true) { area = "B1", kampong = "MANGGIS" }
                else if (address.includes("DELIMA") == true) { area = "B1", kampong = "DELIMA" }
                else if (address.includes("ANGGREK DESA") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("ANGGREK") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("PULAIE") == true) { area = "B1", kampong = "PULAIE" }
                else if (address.includes("LAMBAK") == true) { area = "B1", kampong = "LAMBAK" }
                else if (address.includes("TERUNJING") == true) { area = "B1", kampong = "TERUNJING" }
                else if (address.includes("MADANG") == true) { area = "B1", kampong = "MADANG" }
                else if (address.includes("AIRPORT") == true) { area = "B1", kampong = "AIRPORT" }
                else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("OKBI") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("SERUSOP") == true) { area = "B1", kampong = "SERUSOP" }
                else if (address.includes("BURONG PINGAI") == true) { area = "B1", kampong = "BURONG PINGAI" }
                else if (address.includes("SETIA NEGARA") == true) { area = "B1", kampong = "SETIA NEGARA" }
                else if (address.includes("PASIR BERAKAS") == true) { area = "B1", kampong = "PASIR BERAKAS" }
                else if (address.includes("MENTERI BESAR") == true) { area = "B1", kampong = "MENTERI BESAR" }
                else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B1", kampong = "KEBANGSAAN LAMA" }
                else if (address.includes("BATU MARANG") == true) { area = "B2", kampong = "BATU MARANG" }
                else if (address.includes("DATO GANDI") == true) { area = "B2", kampong = "DATO GANDI" }
                else if (address.includes("KAPOK") == true) { area = "B2", kampong = "KAPOK" }
                else if (address.includes("KOTA BATU") == true) { area = "B2", kampong = "KOTA BATU" }
                else if (address.includes("MENTIRI") == true) { area = "B2", kampong = "MENTIRI" }
                else if (address.includes("MERAGANG") == true) { area = "B2", kampong = "MERAGANG" }
                else if (address.includes("PELAMBAIAN") == true) { area = "B2", kampong = "PELAMBAIAN" }
                else if (address.includes("PINTU MALIM") == true) { area = "B2", kampong = "PINTU MALIM" }
                else if (address.includes("SALAMBIGAR") == true) { area = "B2", kampong = "SALAMBIGAR" }
                else if (address.includes("SALAR") == true) { area = "B2", kampong = "SALAR" }
                else if (address.includes("SERASA") == true) { area = "B2", kampong = "SERASA" }
                else if (address.includes("SERDANG") == true) { area = "B2", kampong = "SERDANG" }
                else if (address.includes("SUNGAI BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SG BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SUNGAI BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SG BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SUNGAI HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SG HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SUNGAI TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SG TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SUBOK") == true) { area = "B2", kampong = "SUBOK" }
                else if (address.includes("SUNGAI AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SG AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SUNGAI BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("SG BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("TANAH JAMBU") == true) { area = "B2", kampong = "TANAH JAMBU" }
                else if (address.includes("SUNGAI OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("SG OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("KATOK") == true) { area = "G1", kampong = "KATOK" }
                else if (address.includes("MATA-MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("MATA MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("RIMBA") == true) { area = "G1", kampong = "RIMBA" }
                else if (address.includes("TUNGKU") == true) { area = "G1", kampong = "TUNGKU" }
                else if (address.includes("UBD") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("JIS") == true) { area = "G1" }
                else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G1", kampong = "JIS" }
                else if (address.includes("BERANGAN") == true) { area = "G2", kampong = "BERANGAN" }
                else if (address.includes("BERIBI") == true) { area = "G2", kampong = "BERIBI" }
                else if (address.includes("KIULAP") == true) { area = "G2", kampong = "KIULAP" }
                else if (address.includes("RIPAS") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("KIARONG") == true) { area = "G2", kampong = "KIARONG" }
                else if (address.includes("PUSAR ULAK") == true) { area = "G2", kampong = "PUSAR ULAK" }
                else if (address.includes("KUMBANG PASANG") == true) { area = "G2", kampong = "KUMBANG PASANG" }
                else if (address.includes("MENGLAIT") == true) { area = "G2", kampong = "MENGLAIT" }
                else if (address.includes("MABOHAI") == true) { area = "G2", kampong = "MABOHAI" }
                else if (address.includes("ONG SUM PING") == true) { area = "G2", kampong = "ONG SUM PING" }
                else if (address.includes("GADONG") == true) { area = "G2", kampong = "GADONG" }
                else if (address.includes("TASEK LAMA") == true) { area = "G2", kampong = "TASEK LAMA" }
                else if (address.includes("BANDAR TOWN") == true) { area = "G2", kampong = "BANDAR TOWN" }
                else if (address.includes("BATU SATU") == true) { area = "JT1", kampong = "BATU SATU" }
                else if (address.includes("BENGKURONG") == true) { area = "JT1", kampong = "BENGKURONG" }
                else if (address.includes("BUNUT") == true) { area = "JT1", kampong = "BUNUT" }
                else if (address.includes("JALAN BABU RAJA") == true) { area = "JT1", kampong = "JALAN BABU RAJA" }
                else if (address.includes("JALAN ISTANA") == true) { area = "JT1", kampong = "JALAN ISTANA" }
                else if (address.includes("JUNJONGAN") == true) { area = "JT1", kampong = "JUNJONGAN" }
                else if (address.includes("KASAT") == true) { area = "JT1", kampong = "KASAT" }
                else if (address.includes("LUMAPAS") == true) { area = "JT1", kampong = "LUMAPAS" }
                else if (address.includes("JALAN HALUS") == true) { area = "JT1", kampong = "JALAN HALUS" }
                else if (address.includes("MADEWA") == true) { area = "JT1", kampong = "MADEWA" }
                else if (address.includes("PUTAT") == true) { area = "JT1", kampong = "PUTAT" }
                else if (address.includes("SINARUBAI") == true) { area = "JT1", kampong = "SINARUBAI" }
                else if (address.includes("TASEK MERADUN") == true) { area = "JT1", kampong = "TASEK MERADUN" }
                else if (address.includes("TELANAI") == true) { area = "JT1", kampong = "TELANAI" }
                else if (address.includes("BAN 1") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 2") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 3") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 4") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 5") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 6") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BATONG") == true) { area = "JT2", kampong = "BATONG" }
                else if (address.includes("BATU AMPAR") == true) { area = "JT2", kampong = "BATU AMPAR" }
                else if (address.includes("BEBATIK") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("BEBULOH") == true) { area = "JT2", kampong = "BEBULOH" }
                else if (address.includes("BEBATIK KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("DADAP") == true) { area = "JT2", kampong = "DADAP" }
                else if (address.includes("KUALA LURAH") == true) { area = "JT2", kampong = "KUALA LURAH" }
                else if (address.includes("KULAPIS") == true) { area = "JT2", kampong = "KULAPIS" }
                else if (address.includes("LIMAU MANIS") == true) { area = "JT2", kampong = "LIMAU MANIS" }
                else if (address.includes("MASIN") == true) { area = "JT2", kampong = "MASIN" }
                else if (address.includes("MULAUT") == true) { area = "JT2", kampong = "MULAUT" }
                else if (address.includes("PANCHOR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANCHUR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANGKALAN BATU") == true) { area = "JT2", kampong = "PANGKALAN BATU" }
                else if (address.includes("PASAI") == true) { area = "JT2", kampong = "PASAI" }
                else if (address.includes("WASAN") == true) { area = "JT2", kampong = "WASAN" }
                else if (address.includes("PARIT") == true) { area = "JT2", kampong = "PARIT" }
                else if (address.includes("EMPIRE") == true) { area = "JT3", kampong = "EMPIRE" }
                else if (address.includes("JANGSAK") == true) { area = "JT3", kampong = "JANGSAK" }
                else if (address.includes("JERUDONG") == true) { area = "JT3", kampong = "JERUDONG" }
                else if (address.includes("KATIMAHAR") == true) { area = "JT3", kampong = "KATIMAHAR" }
                else if (address.includes("LUGU") == true) { area = "JT3", kampong = "LUGU" }
                else if (address.includes("SENGKURONG") == true) { area = "JT3", kampong = "SENGKURONG" }
                else if (address.includes("TANJONG NANGKA") == true) { area = "JT3", kampong = "TANJONG NANGKA" }
                else if (address.includes("TANJONG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("TANJUNG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT3", kampung = "SUNGAI TAMPOI" }
                else if (address.includes("SG TAMPOI") == true) { area = "JT3", kampong = "SUNGAI TAMPOI" }
                else if (address.includes("MUARA") == true) { area = "B2", kampong = "MUARA" }
                //TU
                else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
                else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
                else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
                else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
                else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
                else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
                else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
                else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
                else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
                else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
                else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
                else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
                else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
                else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
                else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
                else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
                else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
                else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
                else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
                else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
                else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
                else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
                else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
                else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
                else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
                else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
                //KB
                else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
                else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
                else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
                else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
                else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
                else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
                else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
                else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
                else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
                else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
                else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
                else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
                else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
                else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
                else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
                else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
                else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
                else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
                else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
                else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
                else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
                else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
                else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
                else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
                else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
                else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
                else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
                else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
                else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
                else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
                else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
                else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
                else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
                else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
                else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
                else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
                else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
                else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
                else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
                else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
                else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
                else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
                else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
                else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
                else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
                else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
                else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
                else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
                else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
                else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
                else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
                //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
                else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
                else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
                else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
                else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
                else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
                else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
                else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
                else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
                else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
                else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
                else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
                else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
                else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
                else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
                else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
                else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
                else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
                else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
                else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
                else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
                else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
                else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
                else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
                else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
                else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
                else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
                else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
                else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
                else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
                else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
                else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
                //TE
                else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
                else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
                else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
                else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
                else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
                else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
                else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
                else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
                else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
                else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
                else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
                else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
                else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
                else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
                else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
                else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
                else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
                else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
                else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
                else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
                else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
                else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
                else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
                else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
                else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
                else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
                else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
                else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
                else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
                else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
                else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
                else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
                else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
                else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
                else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
                else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
                else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
                else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
                else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
                else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
                else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
                else { area = "N/A" }

                document.getElementById("area").value = area;

                if ((document.querySelector('input[name=districtAppointment]:checked').value == "Brunei Muara") || (document.querySelector('input[name=districtAppointment]:checked').value == "Temburong")) {
                    document.getElementById("sendOrderTo").value = "OPD";
                }

                if (document.querySelector('input[name=districtAppointment]:checked').value == "Tutong") {
                    document.getElementById("sendOrderTo").value = "PMMH";
                }

                if (document.querySelector('input[name=districtAppointment]:checked').value == "Belait") {
                    document.getElementById("sendOrderTo").value = "SSBH";
                }

                if (($('input[name=mohCharges]:checked').val() == "Standard")) {
                    document.getElementById('price').value = '4';
                    document.getElementById('Total-Item-Price').value = '4';
                    var deliveryTypeCode = "STD";
                    document.getElementById("deliveryTypeCode").value = deliveryTypeCode;
                    if (moment().format('h') < 12) {
                        if ((moment().add(4, 'days').format('d') == 0) || (moment().add(4, 'days').format('d') == 5)) {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(4, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if ((moment().add(5, 'days').format('d') == 0) || (moment().add(5, 'days').format('d') == 5)) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=mohCharges]:checked').val() == "Express")) {
                    document.getElementById('price').value = '5.5';
                    document.getElementById('Total-Item-Price').value = '5.5';
                    var deliveryTypeCode = "EXP";
                    document.getElementById("deliveryTypeCode").value = deliveryTypeCode;
                    if (moment().format('h') < 12) {
                        if ((moment().add(1, 'days').format('d') == 0) || (moment().add(1, 'days').format('d') == 5)) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if ((moment().add(2, 'days').format('d') == 0) || (moment().add(2, 'days').format('d') == 5)) {
                            document.getElementById("deliveryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(3, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=mohCharges]:checked').val() == "Immediate")) {
                    document.getElementById('price').value = '20';
                    document.getElementById('Total-Item-Price').value = '20';
                    var deliveryTypeCode = "IMM";
                    document.getElementById("deliveryTypeCode").value = deliveryTypeCode;
                    document.getElementById("deliveryDate").value = moment().format('YYYY-MM-DD');
                    document.getElementById("qbServiceDate").value = moment().format('YYYY-MM-DD');
                    document.getElementById("expiryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                    document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                }

                let customerPhone = "+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                let additionalPhone = "";

                if (document.getElementById("contact_2").value.length != 0) {
                    additionalPhone = "+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "");
                    document.getElementById("additionalPhone").value = additionalPhone;
                    document.getElementById("additionalPhone").value = document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "");
                }

                let appointmentPlace = document.getElementById("healthCentreBM").value + document.getElementById("healthCentreTTG").value + document.getElementById("healthCentreTEMB").value + document.getElementById("healthCentreKB").value;

                document.getElementById("customerPhone").value = customerPhone;

                document.getElementById("appointmentPlace").value = appointmentPlace;

                document.getElementById("deliveryType").value = $('input[name=mohCharges]:checked').val();
                document.getElementById("payingPatient").value = $('input[name=mohPayingPatient]:checked').val();

                if ($('input[name=mohPayingPatient]:checked').val() == 'Yes') {
                    var finalTags = 'MOH, PP';
                }

                if ($('input[name=mohPayingPatient]:checked').val() == 'No') {
                    var finalTags = 'MOH';
                }

                $('#submitBtnfinal').attr('disabled', false);

                document.getElementById('submitBtnfinal').click();
            }

            if ($('input[name=products]:checked').val() == "pharmacyjpmc") {
                document.getElementById("receiverName").value = document.getElementById("name").value;
                document.getElementById("receiverEmail").value = document.getElementById("email").value;
                document.getElementById("receiverPhone").value = document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("productdescription").value = "Medicine";
                document.getElementById("itemQuantity").value = "1";

                let customerAddress = document.getElementById("house").value + " " + document.getElementById("kampong").value
                    + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                    + document.getElementById("postal").value;

                document.getElementById("receiverAddress").value = customerAddress;
                document.getElementById("customerAddress").value = customerAddress;

                let address = customerAddress.toUpperCase();
                var kampong = "";

                if (address.includes("MANGGIS") == true) { area = "B1", kampong = "MANGGIS" }
                else if (address.includes("DELIMA") == true) { area = "B1", kampong = "DELIMA" }
                else if (address.includes("ANGGREK DESA") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("ANGGREK") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("PULAIE") == true) { area = "B1", kampong = "PULAIE" }
                else if (address.includes("LAMBAK") == true) { area = "B1", kampong = "LAMBAK" }
                else if (address.includes("TERUNJING") == true) { area = "B1", kampong = "TERUNJING" }
                else if (address.includes("MADANG") == true) { area = "B1", kampong = "MADANG" }
                else if (address.includes("AIRPORT") == true) { area = "B1", kampong = "AIRPORT" }
                else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("OKBI") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("SERUSOP") == true) { area = "B1", kampong = "SERUSOP" }
                else if (address.includes("BURONG PINGAI") == true) { area = "B1", kampong = "BURONG PINGAI" }
                else if (address.includes("SETIA NEGARA") == true) { area = "B1", kampong = "SETIA NEGARA" }
                else if (address.includes("PASIR BERAKAS") == true) { area = "B1", kampong = "PASIR BERAKAS" }
                else if (address.includes("MENTERI BESAR") == true) { area = "B1", kampong = "MENTERI BESAR" }
                else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B1", kampong = "KEBANGSAAN LAMA" }
                else if (address.includes("BATU MARANG") == true) { area = "B2", kampong = "BATU MARANG" }
                else if (address.includes("DATO GANDI") == true) { area = "B2", kampong = "DATO GANDI" }
                else if (address.includes("KAPOK") == true) { area = "B2", kampong = "KAPOK" }
                else if (address.includes("KOTA BATU") == true) { area = "B2", kampong = "KOTA BATU" }
                else if (address.includes("MENTIRI") == true) { area = "B2", kampong = "MENTIRI" }
                else if (address.includes("MERAGANG") == true) { area = "B2", kampong = "MERAGANG" }
                else if (address.includes("PELAMBAIAN") == true) { area = "B2", kampong = "PELAMBAIAN" }
                else if (address.includes("PINTU MALIM") == true) { area = "B2", kampong = "PINTU MALIM" }
                else if (address.includes("SALAMBIGAR") == true) { area = "B2", kampong = "SALAMBIGAR" }
                else if (address.includes("SALAR") == true) { area = "B2", kampong = "SALAR" }
                else if (address.includes("SERASA") == true) { area = "B2", kampong = "SERASA" }
                else if (address.includes("SERDANG") == true) { area = "B2", kampong = "SERDANG" }
                else if (address.includes("SUNGAI BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SG BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SUNGAI BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SG BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SUNGAI HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SG HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SUNGAI TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SG TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SUBOK") == true) { area = "B2", kampong = "SUBOK" }
                else if (address.includes("SUNGAI AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SG AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SUNGAI BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("SG BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("TANAH JAMBU") == true) { area = "B2", kampong = "TANAH JAMBU" }
                else if (address.includes("SUNGAI OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("SG OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("KATOK") == true) { area = "G1", kampong = "KATOK" }
                else if (address.includes("MATA-MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("MATA MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("RIMBA") == true) { area = "G1", kampong = "RIMBA" }
                else if (address.includes("TUNGKU") == true) { area = "G1", kampong = "TUNGKU" }
                else if (address.includes("UBD") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("JIS") == true) { area = "G1" }
                else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G1", kampong = "JIS" }
                else if (address.includes("BERANGAN") == true) { area = "G2", kampong = "BERANGAN" }
                else if (address.includes("BERIBI") == true) { area = "G2", kampong = "BERIBI" }
                else if (address.includes("KIULAP") == true) { area = "G2", kampong = "KIULAP" }
                else if (address.includes("RIPAS") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("KIARONG") == true) { area = "G2", kampong = "KIARONG" }
                else if (address.includes("PUSAR ULAK") == true) { area = "G2", kampong = "PUSAR ULAK" }
                else if (address.includes("KUMBANG PASANG") == true) { area = "G2", kampong = "KUMBANG PASANG" }
                else if (address.includes("MENGLAIT") == true) { area = "G2", kampong = "MENGLAIT" }
                else if (address.includes("MABOHAI") == true) { area = "G2", kampong = "MABOHAI" }
                else if (address.includes("ONG SUM PING") == true) { area = "G2", kampong = "ONG SUM PING" }
                else if (address.includes("GADONG") == true) { area = "G2", kampong = "GADONG" }
                else if (address.includes("TASEK LAMA") == true) { area = "G2", kampong = "TASEK LAMA" }
                else if (address.includes("BANDAR TOWN") == true) { area = "G2", kampong = "BANDAR TOWN" }
                else if (address.includes("BATU SATU") == true) { area = "JT1", kampong = "BATU SATU" }
                else if (address.includes("BENGKURONG") == true) { area = "JT1", kampong = "BENGKURONG" }
                else if (address.includes("BUNUT") == true) { area = "JT1", kampong = "BUNUT" }
                else if (address.includes("JALAN BABU RAJA") == true) { area = "JT1", kampong = "JALAN BABU RAJA" }
                else if (address.includes("JALAN ISTANA") == true) { area = "JT1", kampong = "JALAN ISTANA" }
                else if (address.includes("JUNJONGAN") == true) { area = "JT1", kampong = "JUNJONGAN" }
                else if (address.includes("KASAT") == true) { area = "JT1", kampong = "KASAT" }
                else if (address.includes("LUMAPAS") == true) { area = "JT1", kampong = "LUMAPAS" }
                else if (address.includes("JALAN HALUS") == true) { area = "JT1", kampong = "JALAN HALUS" }
                else if (address.includes("MADEWA") == true) { area = "JT1", kampong = "MADEWA" }
                else if (address.includes("PUTAT") == true) { area = "JT1", kampong = "PUTAT" }
                else if (address.includes("SINARUBAI") == true) { area = "JT1", kampong = "SINARUBAI" }
                else if (address.includes("TASEK MERADUN") == true) { area = "JT1", kampong = "TASEK MERADUN" }
                else if (address.includes("TELANAI") == true) { area = "JT1", kampong = "TELANAI" }
                else if (address.includes("BAN 1") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 2") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 3") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 4") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 5") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 6") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BATONG") == true) { area = "JT2", kampong = "BATONG" }
                else if (address.includes("BATU AMPAR") == true) { area = "JT2", kampong = "BATU AMPAR" }
                else if (address.includes("BEBATIK") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("BEBULOH") == true) { area = "JT2", kampong = "BEBULOH" }
                else if (address.includes("BEBATIK KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("DADAP") == true) { area = "JT2", kampong = "DADAP" }
                else if (address.includes("KUALA LURAH") == true) { area = "JT2", kampong = "KUALA LURAH" }
                else if (address.includes("KULAPIS") == true) { area = "JT2", kampong = "KULAPIS" }
                else if (address.includes("LIMAU MANIS") == true) { area = "JT2", kampong = "LIMAU MANIS" }
                else if (address.includes("MASIN") == true) { area = "JT2", kampong = "MASIN" }
                else if (address.includes("MULAUT") == true) { area = "JT2", kampong = "MULAUT" }
                else if (address.includes("PANCHOR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANCHUR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANGKALAN BATU") == true) { area = "JT2", kampong = "PANGKALAN BATU" }
                else if (address.includes("PASAI") == true) { area = "JT2", kampong = "PASAI" }
                else if (address.includes("WASAN") == true) { area = "JT2", kampong = "WASAN" }
                else if (address.includes("PARIT") == true) { area = "JT2", kampong = "PARIT" }
                else if (address.includes("EMPIRE") == true) { area = "JT3", kampong = "EMPIRE" }
                else if (address.includes("JANGSAK") == true) { area = "JT3", kampong = "JANGSAK" }
                else if (address.includes("JERUDONG") == true) { area = "JT3", kampong = "JERUDONG" }
                else if (address.includes("KATIMAHAR") == true) { area = "JT3", kampong = "KATIMAHAR" }
                else if (address.includes("LUGU") == true) { area = "JT3", kampong = "LUGU" }
                else if (address.includes("SENGKURONG") == true) { area = "JT3", kampong = "SENGKURONG" }
                else if (address.includes("TANJONG NANGKA") == true) { area = "JT3", kampong = "TANJONG NANGKA" }
                else if (address.includes("TANJONG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("TANJUNG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT3", kampung = "SUNGAI TAMPOI" }
                else if (address.includes("SG TAMPOI") == true) { area = "JT3", kampong = "SUNGAI TAMPOI" }
                else if (address.includes("MUARA") == true) { area = "B2", kampong = "MUARA" }
                //TU
                else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
                else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
                else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
                else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
                else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
                else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
                else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
                else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
                else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
                else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
                else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
                else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
                else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
                else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
                else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
                else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
                else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
                else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
                else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
                else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
                else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
                else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
                else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
                else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
                else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
                else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
                //KB
                else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
                else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
                else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
                else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
                else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
                else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
                else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
                else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
                else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
                else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
                else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
                else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
                else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
                else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
                else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
                else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
                else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
                else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
                else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
                else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
                else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
                else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
                else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
                else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
                else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
                else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
                else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
                else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
                else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
                else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
                else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
                else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
                else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
                else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
                else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
                else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
                else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
                else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
                else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
                else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
                else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
                else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
                else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
                else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
                else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
                else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
                else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
                else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
                else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
                else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
                else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
                //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
                else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
                else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
                else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
                else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
                else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
                else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
                else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
                else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
                else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
                else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
                else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
                else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
                else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
                else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
                else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
                else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
                else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
                else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
                else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
                else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
                else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
                else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
                else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
                else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
                else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
                else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
                else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
                else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
                else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
                else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
                else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
                //TE
                else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
                else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
                else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
                else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
                else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
                else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
                else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
                else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
                else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
                else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
                else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
                else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
                else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
                else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
                else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
                else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
                else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
                else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
                else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
                else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
                else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
                else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
                else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
                else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
                else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
                else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
                else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
                else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
                else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
                else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
                else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
                else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
                else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
                else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
                else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
                else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
                else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
                else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
                else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
                else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
                else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
                else { area = "N/A" }

                document.getElementById("area").value = area;

                if (($('input[name=jpmcCharges]:checked').val() == "Express Brunei-Muara")) {
                    document.getElementById('price').value = '5.5';
                    document.getElementById('Total-Item-Price').value = '5.5';
                    if (moment().format('h') < 12) {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(1, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(3, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(2, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(3, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(2, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(4, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                        if ((moment().add(2, 'days').format('d') != 0) || (moment().add(2, 'days').format('d') != 6)) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=jpmcCharges]:checked').val() == "Standard Brunei-Muara")) {
                    document.getElementById('price').value = '4';
                    document.getElementById('Total-Item-Price').value = '4';
                    if (moment().format('h') < 12) {
                        if (moment().add(4, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(4, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(4, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(5, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(5, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(7, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(9, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(9, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('MM/DD/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=jpmcCharges]:checked').val() == "Standard Tutong")) {
                    document.getElementById('price').value = '8';
                    document.getElementById('Total-Item-Price').value = '8';
                    if (moment().format('h') < 12) {
                        if (moment().add(4, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(4, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(4, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(5, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(5, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(7, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(9, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(9, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=jpmcCharges]:checked').val() == "Standard Belait")) {
                    document.getElementById('price').value = '8';
                    document.getElementById('Total-Item-Price').value = '8';
                    if (moment().format('h') < 12) {
                        if (moment().add(4, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(4, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(4, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(5, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(5, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(7, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(9, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(9, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=jpmcCharges]:checked').val() == "Standard Temburong")) {
                    document.getElementById('price').value = '11';
                    document.getElementById('Total-Item-Price').value = '11';
                    if (moment().format('h') < 12) {
                        if (moment().add(4, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(4, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(4, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(5, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                        }
                        if (moment().add(5, 'days').format('d') == 6) {
                            document.getElementById("deliveryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(7, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(9, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(9, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                let customerPhone = "+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                let appointmentPlace = $('input[name=jpmcpjsc]:checked').val();

                document.getElementById("appointmentPlace").value = appointmentPlace;

                document.getElementById("customerPhone").value = customerPhone;

                document.getElementById("deliveryType").value = $('input[name=jpmcCharges]:checked').val();
                document.getElementById("payingPatient").value = $('input[name=jpmcPayingPatient]:checked').val();

                let additionalPhone = "";

                if (document.getElementById("contact_2").value.length != 0) {
                    additionalPhone = "+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "");
                    document.getElementById("additionalPhone").value = additionalPhone;
                    document.getElementById("additionalPhone").value = document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "");
                }

                if ($('input[name=jpmcPayingPatient]:checked').val() == 'Yes') {
                    var finalTags = 'JPMC, PP';
                }

                if ($('input[name=jpmcPayingPatient]:checked').val() == 'No') {
                    var finalTags = 'JPMC';
                }

                $('#submitBtnfinal').attr('disabled', false);

                document.getElementById('submitBtnfinal').click();
            }

            if ($('input[name=products]:checked').val() == "pharmacyphc") {
                document.getElementById("receiverName").value = document.getElementById("name").value;
                document.getElementById("receiverEmail").value = document.getElementById("email").value;
                document.getElementById("receiverPhone").value = document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("productdescription").value = "Medicine";
                document.getElementById("itemQuantity").value = "1";

                let customerAddress = document.getElementById("house").value + " " + document.getElementById("kampong").value
                    + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                    + document.getElementById("postal").value;

                document.getElementById("receiverAddress").value = customerAddress;
                document.getElementById("customerAddress").value = customerAddress;

                let address = customerAddress.toUpperCase();
                var kampong = "";

                if (address.includes("MANGGIS") == true) { area = "B1", kampong = "MANGGIS" }
                else if (address.includes("DELIMA") == true) { area = "B1", kampong = "DELIMA" }
                else if (address.includes("ANGGREK DESA") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("ANGGREK") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("PULAIE") == true) { area = "B1", kampong = "PULAIE" }
                else if (address.includes("LAMBAK") == true) { area = "B1", kampong = "LAMBAK" }
                else if (address.includes("TERUNJING") == true) { area = "B1", kampong = "TERUNJING" }
                else if (address.includes("MADANG") == true) { area = "B1", kampong = "MADANG" }
                else if (address.includes("AIRPORT") == true) { area = "B1", kampong = "AIRPORT" }
                else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("OKBI") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("SERUSOP") == true) { area = "B1", kampong = "SERUSOP" }
                else if (address.includes("BURONG PINGAI") == true) { area = "B1", kampong = "BURONG PINGAI" }
                else if (address.includes("SETIA NEGARA") == true) { area = "B1", kampong = "SETIA NEGARA" }
                else if (address.includes("PASIR BERAKAS") == true) { area = "B1", kampong = "PASIR BERAKAS" }
                else if (address.includes("MENTERI BESAR") == true) { area = "B1", kampong = "MENTERI BESAR" }
                else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B1", kampong = "KEBANGSAAN LAMA" }
                else if (address.includes("BATU MARANG") == true) { area = "B2", kampong = "BATU MARANG" }
                else if (address.includes("DATO GANDI") == true) { area = "B2", kampong = "DATO GANDI" }
                else if (address.includes("KAPOK") == true) { area = "B2", kampong = "KAPOK" }
                else if (address.includes("KOTA BATU") == true) { area = "B2", kampong = "KOTA BATU" }
                else if (address.includes("MENTIRI") == true) { area = "B2", kampong = "MENTIRI" }
                else if (address.includes("MERAGANG") == true) { area = "B2", kampong = "MERAGANG" }
                else if (address.includes("PELAMBAIAN") == true) { area = "B2", kampong = "PELAMBAIAN" }
                else if (address.includes("PINTU MALIM") == true) { area = "B2", kampong = "PINTU MALIM" }
                else if (address.includes("SALAMBIGAR") == true) { area = "B2", kampong = "SALAMBIGAR" }
                else if (address.includes("SALAR") == true) { area = "B2", kampong = "SALAR" }
                else if (address.includes("SERASA") == true) { area = "B2", kampong = "SERASA" }
                else if (address.includes("SERDANG") == true) { area = "B2", kampong = "SERDANG" }
                else if (address.includes("SUNGAI BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SG BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SUNGAI BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SG BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SUNGAI HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SG HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SUNGAI TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SG TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SUBOK") == true) { area = "B2", kampong = "SUBOK" }
                else if (address.includes("SUNGAI AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SG AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SUNGAI BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("SG BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("TANAH JAMBU") == true) { area = "B2", kampong = "TANAH JAMBU" }
                else if (address.includes("SUNGAI OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("SG OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("KATOK") == true) { area = "G1", kampong = "KATOK" }
                else if (address.includes("MATA-MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("MATA MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("RIMBA") == true) { area = "G1", kampong = "RIMBA" }
                else if (address.includes("TUNGKU") == true) { area = "G1", kampong = "TUNGKU" }
                else if (address.includes("UBD") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("JIS") == true) { area = "G1" }
                else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G1", kampong = "JIS" }
                else if (address.includes("BERANGAN") == true) { area = "G2", kampong = "BERANGAN" }
                else if (address.includes("BERIBI") == true) { area = "G2", kampong = "BERIBI" }
                else if (address.includes("KIULAP") == true) { area = "G2", kampong = "KIULAP" }
                else if (address.includes("RIPAS") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("KIARONG") == true) { area = "G2", kampong = "KIARONG" }
                else if (address.includes("PUSAR ULAK") == true) { area = "G2", kampong = "PUSAR ULAK" }
                else if (address.includes("KUMBANG PASANG") == true) { area = "G2", kampong = "KUMBANG PASANG" }
                else if (address.includes("MENGLAIT") == true) { area = "G2", kampong = "MENGLAIT" }
                else if (address.includes("MABOHAI") == true) { area = "G2", kampong = "MABOHAI" }
                else if (address.includes("ONG SUM PING") == true) { area = "G2", kampong = "ONG SUM PING" }
                else if (address.includes("GADONG") == true) { area = "G2", kampong = "GADONG" }
                else if (address.includes("TASEK LAMA") == true) { area = "G2", kampong = "TASEK LAMA" }
                else if (address.includes("BANDAR TOWN") == true) { area = "G2", kampong = "BANDAR TOWN" }
                else if (address.includes("BATU SATU") == true) { area = "JT1", kampong = "BATU SATU" }
                else if (address.includes("BENGKURONG") == true) { area = "JT1", kampong = "BENGKURONG" }
                else if (address.includes("BUNUT") == true) { area = "JT1", kampong = "BUNUT" }
                else if (address.includes("JALAN BABU RAJA") == true) { area = "JT1", kampong = "JALAN BABU RAJA" }
                else if (address.includes("JALAN ISTANA") == true) { area = "JT1", kampong = "JALAN ISTANA" }
                else if (address.includes("JUNJONGAN") == true) { area = "JT1", kampong = "JUNJONGAN" }
                else if (address.includes("KASAT") == true) { area = "JT1", kampong = "KASAT" }
                else if (address.includes("LUMAPAS") == true) { area = "JT1", kampong = "LUMAPAS" }
                else if (address.includes("JALAN HALUS") == true) { area = "JT1", kampong = "JALAN HALUS" }
                else if (address.includes("MADEWA") == true) { area = "JT1", kampong = "MADEWA" }
                else if (address.includes("PUTAT") == true) { area = "JT1", kampong = "PUTAT" }
                else if (address.includes("SINARUBAI") == true) { area = "JT1", kampong = "SINARUBAI" }
                else if (address.includes("TASEK MERADUN") == true) { area = "JT1", kampong = "TASEK MERADUN" }
                else if (address.includes("TELANAI") == true) { area = "JT1", kampong = "TELANAI" }
                else if (address.includes("BAN 1") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 2") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 3") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 4") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 5") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 6") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BATONG") == true) { area = "JT2", kampong = "BATONG" }
                else if (address.includes("BATU AMPAR") == true) { area = "JT2", kampong = "BATU AMPAR" }
                else if (address.includes("BEBATIK") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("BEBULOH") == true) { area = "JT2", kampong = "BEBULOH" }
                else if (address.includes("BEBATIK KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("DADAP") == true) { area = "JT2", kampong = "DADAP" }
                else if (address.includes("KUALA LURAH") == true) { area = "JT2", kampong = "KUALA LURAH" }
                else if (address.includes("KULAPIS") == true) { area = "JT2", kampong = "KULAPIS" }
                else if (address.includes("LIMAU MANIS") == true) { area = "JT2", kampong = "LIMAU MANIS" }
                else if (address.includes("MASIN") == true) { area = "JT2", kampong = "MASIN" }
                else if (address.includes("MULAUT") == true) { area = "JT2", kampong = "MULAUT" }
                else if (address.includes("PANCHOR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANCHUR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANGKALAN BATU") == true) { area = "JT2", kampong = "PANGKALAN BATU" }
                else if (address.includes("PASAI") == true) { area = "JT2", kampong = "PASAI" }
                else if (address.includes("WASAN") == true) { area = "JT2", kampong = "WASAN" }
                else if (address.includes("PARIT") == true) { area = "JT2", kampong = "PARIT" }
                else if (address.includes("EMPIRE") == true) { area = "JT3", kampong = "EMPIRE" }
                else if (address.includes("JANGSAK") == true) { area = "JT3", kampong = "JANGSAK" }
                else if (address.includes("JERUDONG") == true) { area = "JT3", kampong = "JERUDONG" }
                else if (address.includes("KATIMAHAR") == true) { area = "JT3", kampong = "KATIMAHAR" }
                else if (address.includes("LUGU") == true) { area = "JT3", kampong = "LUGU" }
                else if (address.includes("SENGKURONG") == true) { area = "JT3", kampong = "SENGKURONG" }
                else if (address.includes("TANJONG NANGKA") == true) { area = "JT3", kampong = "TANJONG NANGKA" }
                else if (address.includes("TANJONG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("TANJUNG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT3", kampung = "SUNGAI TAMPOI" }
                else if (address.includes("SG TAMPOI") == true) { area = "JT3", kampong = "SUNGAI TAMPOI" }
                else if (address.includes("MUARA") == true) { area = "B2", kampong = "MUARA" }
                //TU
                else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
                else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
                else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
                else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
                else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
                else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
                else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
                else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
                else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
                else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
                else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
                else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
                else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
                else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
                else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
                else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
                else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
                else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
                else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
                else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
                else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
                else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
                else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
                else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
                else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
                else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
                //KB
                else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
                else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
                else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
                else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
                else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
                else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
                else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
                else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
                else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
                else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
                else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
                else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
                else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
                else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
                else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
                else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
                else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
                else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
                else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
                else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
                else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
                else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
                else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
                else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
                else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
                else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
                else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
                else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
                else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
                else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
                else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
                else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
                else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
                else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
                else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
                else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
                else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
                else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
                else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
                else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
                else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
                else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
                else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
                else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
                else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
                else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
                else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
                else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
                else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
                else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
                else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
                //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
                else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
                else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
                else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
                else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
                else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
                else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
                else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
                else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
                else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
                else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
                else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
                else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
                else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
                else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
                else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
                else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
                else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
                else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
                else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
                else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
                else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
                else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
                else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
                else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
                else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
                else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
                else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
                else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
                else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
                else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
                else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
                //TE
                else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
                else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
                else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
                else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
                else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
                else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
                else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
                else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
                else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
                else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
                else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
                else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
                else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
                else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
                else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
                else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
                else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
                else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
                else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
                else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
                else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
                else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
                else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
                else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
                else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
                else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
                else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
                else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
                else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
                else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
                else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
                else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
                else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
                else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
                else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
                else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
                else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
                else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
                else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
                else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
                else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
                else { area = "N/A" }

                document.getElementById("area").value = area;

                if (($('input[name=phcCharges]:checked').val() == "Standard Belait")) {
                    document.getElementById('price').value = '3';
                    document.getElementById('Total-Item-Price').value = '3';
                }

                if (($('input[name=phcCharges]:checked').val() == "Standard Tutong")) {
                    document.getElementById('price').value = '5';
                    document.getElementById('Total-Item-Price').value = '5';
                }

                if (($('input[name=phcCharges]:checked').val() == "Standard Brunei-Muara")) {
                    document.getElementById('price').value = '7';
                    document.getElementById('Total-Item-Price').value = '7';
                }

                if (($('input[name=phcCharges]:checked').val() == "Standard Temburong")) {
                    document.getElementById('price').value = '10';
                    document.getElementById('Total-Item-Price').value = '10';
                }

                if (moment().format('h') < 12) {
                    if ((moment().add(4, 'days').format('d') == 0) || (moment().add(4, 'days').format('d') == 5)) {
                        document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                    } else {
                        document.getElementById("deliveryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(4, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                    }
                } else {
                    if ((moment().add(5, 'days').format('d') == 0) || (moment().add(5, 'days').format('d') == 5)) {
                        document.getElementById("deliveryDate").value = moment().add(6, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(6, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(8, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(8, 'days').format('MM/DD/YYYY');
                    } else {
                        document.getElementById("deliveryDate").value = moment().add(5, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(5, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(7, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                    }
                }

                let customerPhone = "+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                let additionalPhone = "";

                if (document.getElementById("contact_2").value.length != 0) {
                    additionalPhone = "+" + document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "");
                    document.getElementById("additionalPhone").value = additionalPhone;
                    document.getElementById("additionalPhone").value = document.getElementById("code_2").value + document.getElementById("contact_2").value.replace(" ", "");
                }

                document.getElementById("customerPhone").value = customerPhone;

                document.getElementById("appointmentPlace").value = appointmentPlace;

                document.getElementById("deliveryType").value = $('input[name=phcCharges]:checked').val();
                document.getElementById("payingPatient").value = $('input[name=phcPayingPatient]:checked').val();

                if ($('input[name=phcPayingPatient]:checked').val() == 'Yes') {
                    var finalTags = 'PHC, PP';
                }

                if ($('input[name=phcPayingPatient]:checked').val() == 'No') {
                    var finalTags = 'PHC';
                }

                $('#submitBtnfinal').attr('disabled', false);

                document.getElementById('submitBtnfinal').click();
            }

            if ($('input[name=products]:checked').val() == "grp") {
                document.getElementById("receiverName").value = document.getElementById("name").value;
                document.getElementById("receiverEmail").value = document.getElementById("email").value;
                document.getElementById("receiverPhone").value = document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("productdescription").value = document.getElementById("Item-Description").value;
                document.getElementById("itemQuantity").value = document.getElementById("Quantity").value;

                let customerAddress = document.getElementById("house").value + " " + document.getElementById("kampong").value
                    + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                    + document.getElementById("postal").value;

                document.getElementById("receiverAddress").value = customerAddress;
                document.getElementById("customerAddress").value = customerAddress;

                let address = customerAddress.toUpperCase();
                var kampong = "";

                if (address.includes("MANGGIS") == true) { area = "B1", kampong = "MANGGIS" }
                else if (address.includes("DELIMA") == true) { area = "B1", kampong = "DELIMA" }
                else if (address.includes("ANGGREK DESA") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("ANGGREK") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("PULAIE") == true) { area = "B1", kampong = "PULAIE" }
                else if (address.includes("LAMBAK") == true) { area = "B1", kampong = "LAMBAK" }
                else if (address.includes("TERUNJING") == true) { area = "B1", kampong = "TERUNJING" }
                else if (address.includes("MADANG") == true) { area = "B1", kampong = "MADANG" }
                else if (address.includes("AIRPORT") == true) { area = "B1", kampong = "AIRPORT" }
                else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("OKBI") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("SERUSOP") == true) { area = "B1", kampong = "SERUSOP" }
                else if (address.includes("BURONG PINGAI") == true) { area = "B1", kampong = "BURONG PINGAI" }
                else if (address.includes("SETIA NEGARA") == true) { area = "B1", kampong = "SETIA NEGARA" }
                else if (address.includes("PASIR BERAKAS") == true) { area = "B1", kampong = "PASIR BERAKAS" }
                else if (address.includes("MENTERI BESAR") == true) { area = "B1", kampong = "MENTERI BESAR" }
                else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B1", kampong = "KEBANGSAAN LAMA" }
                else if (address.includes("BATU MARANG") == true) { area = "B2", kampong = "BATU MARANG" }
                else if (address.includes("DATO GANDI") == true) { area = "B2", kampong = "DATO GANDI" }
                else if (address.includes("KAPOK") == true) { area = "B2", kampong = "KAPOK" }
                else if (address.includes("KOTA BATU") == true) { area = "B2", kampong = "KOTA BATU" }
                else if (address.includes("MENTIRI") == true) { area = "B2", kampong = "MENTIRI" }
                else if (address.includes("MERAGANG") == true) { area = "B2", kampong = "MERAGANG" }
                else if (address.includes("PELAMBAIAN") == true) { area = "B2", kampong = "PELAMBAIAN" }
                else if (address.includes("PINTU MALIM") == true) { area = "B2", kampong = "PINTU MALIM" }
                else if (address.includes("SALAMBIGAR") == true) { area = "B2", kampong = "SALAMBIGAR" }
                else if (address.includes("SALAR") == true) { area = "B2", kampong = "SALAR" }
                else if (address.includes("SERASA") == true) { area = "B2", kampong = "SERASA" }
                else if (address.includes("SERDANG") == true) { area = "B2", kampong = "SERDANG" }
                else if (address.includes("SUNGAI BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SG BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SUNGAI BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SG BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SUNGAI HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SG HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SUNGAI TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SG TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SUBOK") == true) { area = "B2", kampong = "SUBOK" }
                else if (address.includes("SUNGAI AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SG AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SUNGAI BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("SG BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("TANAH JAMBU") == true) { area = "B2", kampong = "TANAH JAMBU" }
                else if (address.includes("SUNGAI OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("SG OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("KATOK") == true) { area = "G1", kampong = "KATOK" }
                else if (address.includes("MATA-MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("MATA MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("RIMBA") == true) { area = "G1", kampong = "RIMBA" }
                else if (address.includes("TUNGKU") == true) { area = "G1", kampong = "TUNGKU" }
                else if (address.includes("UBD") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("JIS") == true) { area = "G1" }
                else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G1", kampong = "JIS" }
                else if (address.includes("BERANGAN") == true) { area = "G2", kampong = "BERANGAN" }
                else if (address.includes("BERIBI") == true) { area = "G2", kampong = "BERIBI" }
                else if (address.includes("KIULAP") == true) { area = "G2", kampong = "KIULAP" }
                else if (address.includes("RIPAS") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("KIARONG") == true) { area = "G2", kampong = "KIARONG" }
                else if (address.includes("PUSAR ULAK") == true) { area = "G2", kampong = "PUSAR ULAK" }
                else if (address.includes("KUMBANG PASANG") == true) { area = "G2", kampong = "KUMBANG PASANG" }
                else if (address.includes("MENGLAIT") == true) { area = "G2", kampong = "MENGLAIT" }
                else if (address.includes("MABOHAI") == true) { area = "G2", kampong = "MABOHAI" }
                else if (address.includes("ONG SUM PING") == true) { area = "G2", kampong = "ONG SUM PING" }
                else if (address.includes("GADONG") == true) { area = "G2", kampong = "GADONG" }
                else if (address.includes("TASEK LAMA") == true) { area = "G2", kampong = "TASEK LAMA" }
                else if (address.includes("BANDAR TOWN") == true) { area = "G2", kampong = "BANDAR TOWN" }
                else if (address.includes("BATU SATU") == true) { area = "JT1", kampong = "BATU SATU" }
                else if (address.includes("BENGKURONG") == true) { area = "JT1", kampong = "BENGKURONG" }
                else if (address.includes("BUNUT") == true) { area = "JT1", kampong = "BUNUT" }
                else if (address.includes("JALAN BABU RAJA") == true) { area = "JT1", kampong = "JALAN BABU RAJA" }
                else if (address.includes("JALAN ISTANA") == true) { area = "JT1", kampong = "JALAN ISTANA" }
                else if (address.includes("JUNJONGAN") == true) { area = "JT1", kampong = "JUNJONGAN" }
                else if (address.includes("KASAT") == true) { area = "JT1", kampong = "KASAT" }
                else if (address.includes("LUMAPAS") == true) { area = "JT1", kampong = "LUMAPAS" }
                else if (address.includes("JALAN HALUS") == true) { area = "JT1", kampong = "JALAN HALUS" }
                else if (address.includes("MADEWA") == true) { area = "JT1", kampong = "MADEWA" }
                else if (address.includes("PUTAT") == true) { area = "JT1", kampong = "PUTAT" }
                else if (address.includes("SINARUBAI") == true) { area = "JT1", kampong = "SINARUBAI" }
                else if (address.includes("TASEK MERADUN") == true) { area = "JT1", kampong = "TASEK MERADUN" }
                else if (address.includes("TELANAI") == true) { area = "JT1", kampong = "TELANAI" }
                else if (address.includes("BAN 1") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 2") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 3") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 4") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 5") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 6") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BATONG") == true) { area = "JT2", kampong = "BATONG" }
                else if (address.includes("BATU AMPAR") == true) { area = "JT2", kampong = "BATU AMPAR" }
                else if (address.includes("BEBATIK") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("BEBULOH") == true) { area = "JT2", kampong = "BEBULOH" }
                else if (address.includes("BEBATIK KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("DADAP") == true) { area = "JT2", kampong = "DADAP" }
                else if (address.includes("KUALA LURAH") == true) { area = "JT2", kampong = "KUALA LURAH" }
                else if (address.includes("KULAPIS") == true) { area = "JT2", kampong = "KULAPIS" }
                else if (address.includes("LIMAU MANIS") == true) { area = "JT2", kampong = "LIMAU MANIS" }
                else if (address.includes("MASIN") == true) { area = "JT2", kampong = "MASIN" }
                else if (address.includes("MULAUT") == true) { area = "JT2", kampong = "MULAUT" }
                else if (address.includes("PANCHOR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANCHUR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANGKALAN BATU") == true) { area = "JT2", kampong = "PANGKALAN BATU" }
                else if (address.includes("PASAI") == true) { area = "JT2", kampong = "PASAI" }
                else if (address.includes("WASAN") == true) { area = "JT2", kampong = "WASAN" }
                else if (address.includes("PARIT") == true) { area = "JT2", kampong = "PARIT" }
                else if (address.includes("EMPIRE") == true) { area = "JT3", kampong = "EMPIRE" }
                else if (address.includes("JANGSAK") == true) { area = "JT3", kampong = "JANGSAK" }
                else if (address.includes("JERUDONG") == true) { area = "JT3", kampong = "JERUDONG" }
                else if (address.includes("KATIMAHAR") == true) { area = "JT3", kampong = "KATIMAHAR" }
                else if (address.includes("LUGU") == true) { area = "JT3", kampong = "LUGU" }
                else if (address.includes("SENGKURONG") == true) { area = "JT3", kampong = "SENGKURONG" }
                else if (address.includes("TANJONG NANGKA") == true) { area = "JT3", kampong = "TANJONG NANGKA" }
                else if (address.includes("TANJONG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("TANJUNG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT3", kampung = "SUNGAI TAMPOI" }
                else if (address.includes("SG TAMPOI") == true) { area = "JT3", kampong = "SUNGAI TAMPOI" }
                else if (address.includes("MUARA") == true) { area = "B2", kampong = "MUARA" }
                //TU
                else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
                else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
                else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
                else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
                else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
                else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
                else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
                else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
                else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
                else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
                else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
                else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
                else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
                else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
                else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
                else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
                else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
                else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
                else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
                else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
                else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
                else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
                else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
                else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
                else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
                else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
                //KB
                else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
                else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
                else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
                else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
                else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
                else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
                else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
                else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
                else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
                else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
                else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
                else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
                else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
                else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
                else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
                else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
                else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
                else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
                else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
                else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
                else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
                else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
                else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
                else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
                else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
                else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
                else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
                else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
                else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
                else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
                else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
                else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
                else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
                else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
                else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
                else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
                else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
                else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
                else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
                else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
                else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
                else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
                else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
                else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
                else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
                else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
                else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
                else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
                else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
                else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
                else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
                //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
                else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
                else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
                else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
                else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
                else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
                else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
                else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
                else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
                else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
                else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
                else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
                else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
                else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
                else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
                else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
                else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
                else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
                else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
                else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
                else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
                else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
                else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
                else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
                else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
                else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
                else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
                else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
                else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
                else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
                else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
                else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
                //TE
                else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
                else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
                else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
                else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
                else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
                else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
                else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
                else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
                else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
                else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
                else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
                else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
                else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
                else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
                else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
                else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
                else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
                else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
                else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
                else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
                else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
                else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
                else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
                else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
                else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
                else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
                else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
                else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
                else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
                else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
                else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
                else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
                else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
                else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
                else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
                else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
                else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
                else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
                else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
                else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
                else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
                else { area = "N/A" }

                document.getElementById("area").value = area;

                var codeN = "/GRP";
                var conN = document.getElementById("name").value;
                document.getElementById("buyerName").value = conN + codeN;

                if (document.getElementById("GoRushReceivingCountry").value == "MALAYSIA") {
                    if ($('input[name=shipmentMethod]:checked').val() == "Air Freight") {
                        document.getElementById("warehouseReference").value = "MAL/AIRGRP" + " - " + conN;
                    }

                    if ($('input[name=shipmentMethod]:checked').val() == "Sea Freight") {
                        document.getElementById("warehouseReference").value = "MAL/GRP" + " - " + conN;
                    }
                }

                if (document.getElementById("GoRushReceivingCountry").value == "CHINA") {
                    if ($('input[name=shipmentMethod]:checked').val() == "Air Freight") {
                        document.getElementById("warehouseReference").value = "GZ/AIRGRP" + " - " + conN;
                    }

                    if ($('input[name=shipmentMethod]:checked').val() == "Sea Freight") {
                        document.getElementById("warehouseReference").value = "GZ/GRP" + " - " + conN;
                    }
                }

                if (document.getElementById("GoRushReceivingCountry").value == "SINGAPORE") {
                    if ($('input[name=shipmentMethod]:checked').val() == "Air Freight") {
                        document.getElementById("warehouseReference").value = "SIN/AIRGRP" + " - " + conN;
                    }

                    if ($('input[name=shipmentMethod]:checked').val() == "Sea Freight") {
                        document.getElementById("warehouseReference").value = "SIN/GRP" + " - " + conN;
                    }
                }

                let customerPhone = "+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("customerPhone").value = customerPhone;

                if (moment().format('h') < 12) {
                    if (moment().add(13, 'days').format('d') == 0) {
                        document.getElementById("deliveryDate").value = moment().add(14, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(14, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(20, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(20, 'days').format('MM/DD/YYYY');


                    } else {
                        document.getElementById("deliveryDate").value = moment().add(13, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(13, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(19, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(19, 'days').format('MM/DD/YYYY');
                    }
                } else {
                    if (moment().add(14, 'days').format('d') == 0) {
                        document.getElementById("deliveryDate").value = moment().add(15, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(15, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(21, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(21, 'days').format('MM/DD/YYYY');
                    } else {
                        document.getElementById("deliveryDate").value = moment().add(14, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(14, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(20, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(20, 'days').format('MM/DD/YYYY');
                    }
                }

                //Go Rush Plus Orders V2 [database]
                if (tempSplit == 1) {
                    const scriptURL = 'https://script.google.com/macros/s/AKfycbyT31WOUuuXYtLxiKZpTDrNg0cyO7IgDQRTXij1EdOoVrq03AkRDJAa1BFshM2HJ6k5ow/exec'
                    const form = document.forms['guestorderform']

                    fetch(scriptURL, { method: 'POST', body: new FormData(form) })
                }

                //GOBELI - DAILY RECEIVE [ORDERSLIVE]
                if (gobeliDailyReceiveSheet == 1) {
                    const scriptURL = 'https://script.google.com/macros/s/AKfycbxNHKzgMQRRPGdYX9iJlQPl48w04CRF3KlIzDiZMRVI3cVLe5l3ojMa8xvXur4Pi4FR/exec'
                    const form = document.forms['guestorderform']

                    fetch(scriptURL, { method: 'POST', body: new FormData(form) })
                }

                if ($('input[name=pickupordeliverygrp]:checked').val() == "pickup") {
                    document.getElementById("deliveryType").value = "Pickup"
                } else {
                    document.getElementById("deliveryType").value = $('input[name=grpCharges]:checked').val();
                }

                if (($('input[name=grpCharges]:checked').val() == "Immediate Brunei Muara")) {
                    document.getElementById("price").value = (20).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (20).toFixed(2)

                }

                if (($('input[name=grpCharges]:checked').val() == "Drop off Brunei Muara")) {
                    document.getElementById("price").value = (4).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (4).toFixed(2)

                }

                if (($('input[name=grpCharges]:checked').val() == "Drop off Tutong")) {
                    document.getElementById("price").value = (6).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (6).toFixed(2)
                }

                if (($('input[name=grpCharges]:checked').val() == "Drop off Belait")) {
                    document.getElementById("price").value = (8).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (8).toFixed(2)
                }

                if (($('input[name=grpCharges]:checked').val() == "Drop off Temburong")) {
                    document.getElementById("price").value = (11).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (11).toFixed(2)
                }

                $('#submitBtnfinal').attr('disabled', false);

                document.getElementById('submitBtnfinal').click();
            }

            if ($('input[name=products]:checked').val() == "localdelivery") {
                document.getElementById("senderName").value = document.getElementById("name").value;
                document.getElementById("senderEmail").value = document.getElementById("email").value;
                document.getElementById("senderPhone").value = document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("itemQuantity").value = "1";

                let customerAddress = document.getElementById("house").value + " " + document.getElementById("kampong").value
                    + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                    + document.getElementById("postal").value;

                let deliveryAddress = document.getElementById("receiverHouse").value + " " + document.getElementById("receiverKampong").value
                    + " " + document.getElementById("receiverJalan").value + " " + document.getElementById("receiverSimpang").value + " " + $('input[name=receiverDistrict]:checked').val() + " "
                    + document.getElementById("receiverPostal").value;

                document.getElementById("receiverAddress").value = deliveryAddress;
                document.getElementById("customerAddress").value = customerAddress;
                document.getElementById("senderAddress").value = customerAddress;

                let address = deliveryAddress.toUpperCase();
                var kampong = "";

                if (address.includes("MANGGIS") == true) { area = "B1", kampong = "MANGGIS" }
                else if (address.includes("DELIMA") == true) { area = "B1", kampong = "DELIMA" }
                else if (address.includes("ANGGREK DESA") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("ANGGREK") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("PULAIE") == true) { area = "B1", kampong = "PULAIE" }
                else if (address.includes("LAMBAK") == true) { area = "B1", kampong = "LAMBAK" }
                else if (address.includes("TERUNJING") == true) { area = "B1", kampong = "TERUNJING" }
                else if (address.includes("MADANG") == true) { area = "B1", kampong = "MADANG" }
                else if (address.includes("AIRPORT") == true) { area = "B1", kampong = "AIRPORT" }
                else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("OKBI") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("SERUSOP") == true) { area = "B1", kampong = "SERUSOP" }
                else if (address.includes("BURONG PINGAI") == true) { area = "B1", kampong = "BURONG PINGAI" }
                else if (address.includes("SETIA NEGARA") == true) { area = "B1", kampong = "SETIA NEGARA" }
                else if (address.includes("PASIR BERAKAS") == true) { area = "B1", kampong = "PASIR BERAKAS" }
                else if (address.includes("MENTERI BESAR") == true) { area = "B1", kampong = "MENTERI BESAR" }
                else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B1", kampong = "KEBANGSAAN LAMA" }
                else if (address.includes("BATU MARANG") == true) { area = "B2", kampong = "BATU MARANG" }
                else if (address.includes("DATO GANDI") == true) { area = "B2", kampong = "DATO GANDI" }
                else if (address.includes("KAPOK") == true) { area = "B2", kampong = "KAPOK" }
                else if (address.includes("KOTA BATU") == true) { area = "B2", kampong = "KOTA BATU" }
                else if (address.includes("MENTIRI") == true) { area = "B2", kampong = "MENTIRI" }
                else if (address.includes("MERAGANG") == true) { area = "B2", kampong = "MERAGANG" }
                else if (address.includes("PELAMBAIAN") == true) { area = "B2", kampong = "PELAMBAIAN" }
                else if (address.includes("PINTU MALIM") == true) { area = "B2", kampong = "PINTU MALIM" }
                else if (address.includes("SALAMBIGAR") == true) { area = "B2", kampong = "SALAMBIGAR" }
                else if (address.includes("SALAR") == true) { area = "B2", kampong = "SALAR" }
                else if (address.includes("SERASA") == true) { area = "B2", kampong = "SERASA" }
                else if (address.includes("SERDANG") == true) { area = "B2", kampong = "SERDANG" }
                else if (address.includes("SUNGAI BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SG BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SUNGAI BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SG BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SUNGAI HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SG HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SUNGAI TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SG TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SUBOK") == true) { area = "B2", kampong = "SUBOK" }
                else if (address.includes("SUNGAI AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SG AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SUNGAI BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("SG BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("TANAH JAMBU") == true) { area = "B2", kampong = "TANAH JAMBU" }
                else if (address.includes("SUNGAI OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("SG OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("KATOK") == true) { area = "G1", kampong = "KATOK" }
                else if (address.includes("MATA-MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("MATA MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("RIMBA") == true) { area = "G1", kampong = "RIMBA" }
                else if (address.includes("TUNGKU") == true) { area = "G1", kampong = "TUNGKU" }
                else if (address.includes("UBD") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("JIS") == true) { area = "G1" }
                else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G1", kampong = "JIS" }
                else if (address.includes("BERANGAN") == true) { area = "G2", kampong = "BERANGAN" }
                else if (address.includes("BERIBI") == true) { area = "G2", kampong = "BERIBI" }
                else if (address.includes("KIULAP") == true) { area = "G2", kampong = "KIULAP" }
                else if (address.includes("RIPAS") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("KIARONG") == true) { area = "G2", kampong = "KIARONG" }
                else if (address.includes("PUSAR ULAK") == true) { area = "G2", kampong = "PUSAR ULAK" }
                else if (address.includes("KUMBANG PASANG") == true) { area = "G2", kampong = "KUMBANG PASANG" }
                else if (address.includes("MENGLAIT") == true) { area = "G2", kampong = "MENGLAIT" }
                else if (address.includes("MABOHAI") == true) { area = "G2", kampong = "MABOHAI" }
                else if (address.includes("ONG SUM PING") == true) { area = "G2", kampong = "ONG SUM PING" }
                else if (address.includes("GADONG") == true) { area = "G2", kampong = "GADONG" }
                else if (address.includes("TASEK LAMA") == true) { area = "G2", kampong = "TASEK LAMA" }
                else if (address.includes("BANDAR TOWN") == true) { area = "G2", kampong = "BANDAR TOWN" }
                else if (address.includes("BATU SATU") == true) { area = "JT1", kampong = "BATU SATU" }
                else if (address.includes("BENGKURONG") == true) { area = "JT1", kampong = "BENGKURONG" }
                else if (address.includes("BUNUT") == true) { area = "JT1", kampong = "BUNUT" }
                else if (address.includes("JALAN BABU RAJA") == true) { area = "JT1", kampong = "JALAN BABU RAJA" }
                else if (address.includes("JALAN ISTANA") == true) { area = "JT1", kampong = "JALAN ISTANA" }
                else if (address.includes("JUNJONGAN") == true) { area = "JT1", kampong = "JUNJONGAN" }
                else if (address.includes("KASAT") == true) { area = "JT1", kampong = "KASAT" }
                else if (address.includes("LUMAPAS") == true) { area = "JT1", kampong = "LUMAPAS" }
                else if (address.includes("JALAN HALUS") == true) { area = "JT1", kampong = "JALAN HALUS" }
                else if (address.includes("MADEWA") == true) { area = "JT1", kampong = "MADEWA" }
                else if (address.includes("PUTAT") == true) { area = "JT1", kampong = "PUTAT" }
                else if (address.includes("SINARUBAI") == true) { area = "JT1", kampong = "SINARUBAI" }
                else if (address.includes("TASEK MERADUN") == true) { area = "JT1", kampong = "TASEK MERADUN" }
                else if (address.includes("TELANAI") == true) { area = "JT1", kampong = "TELANAI" }
                else if (address.includes("BAN 1") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 2") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 3") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 4") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 5") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 6") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BATONG") == true) { area = "JT2", kampong = "BATONG" }
                else if (address.includes("BATU AMPAR") == true) { area = "JT2", kampong = "BATU AMPAR" }
                else if (address.includes("BEBATIK") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("BEBULOH") == true) { area = "JT2", kampong = "BEBULOH" }
                else if (address.includes("BEBATIK KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("DADAP") == true) { area = "JT2", kampong = "DADAP" }
                else if (address.includes("KUALA LURAH") == true) { area = "JT2", kampong = "KUALA LURAH" }
                else if (address.includes("KULAPIS") == true) { area = "JT2", kampong = "KULAPIS" }
                else if (address.includes("LIMAU MANIS") == true) { area = "JT2", kampong = "LIMAU MANIS" }
                else if (address.includes("MASIN") == true) { area = "JT2", kampong = "MASIN" }
                else if (address.includes("MULAUT") == true) { area = "JT2", kampong = "MULAUT" }
                else if (address.includes("PANCHOR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANCHUR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANGKALAN BATU") == true) { area = "JT2", kampong = "PANGKALAN BATU" }
                else if (address.includes("PASAI") == true) { area = "JT2", kampong = "PASAI" }
                else if (address.includes("WASAN") == true) { area = "JT2", kampong = "WASAN" }
                else if (address.includes("PARIT") == true) { area = "JT2", kampong = "PARIT" }
                else if (address.includes("EMPIRE") == true) { area = "JT3", kampong = "EMPIRE" }
                else if (address.includes("JANGSAK") == true) { area = "JT3", kampong = "JANGSAK" }
                else if (address.includes("JERUDONG") == true) { area = "JT3", kampong = "JERUDONG" }
                else if (address.includes("KATIMAHAR") == true) { area = "JT3", kampong = "KATIMAHAR" }
                else if (address.includes("LUGU") == true) { area = "JT3", kampong = "LUGU" }
                else if (address.includes("SENGKURONG") == true) { area = "JT3", kampong = "SENGKURONG" }
                else if (address.includes("TANJONG NANGKA") == true) { area = "JT3", kampong = "TANJONG NANGKA" }
                else if (address.includes("TANJONG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("TANJUNG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT3", kampung = "SUNGAI TAMPOI" }
                else if (address.includes("SG TAMPOI") == true) { area = "JT3", kampong = "SUNGAI TAMPOI" }
                else if (address.includes("MUARA") == true) { area = "B2", kampong = "MUARA" }
                //TU
                else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
                else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
                else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
                else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
                else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
                else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
                else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
                else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
                else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
                else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
                else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
                else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
                else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
                else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
                else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
                else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
                else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
                else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
                else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
                else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
                else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
                else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
                else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
                else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
                else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
                else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
                //KB
                else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
                else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
                else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
                else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
                else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
                else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
                else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
                else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
                else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
                else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
                else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
                else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
                else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
                else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
                else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
                else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
                else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
                else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
                else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
                else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
                else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
                else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
                else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
                else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
                else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
                else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
                else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
                else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
                else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
                else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
                else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
                else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
                else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
                else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
                else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
                else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
                else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
                else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
                else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
                else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
                else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
                else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
                else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
                else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
                else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
                else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
                else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
                else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
                else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
                else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
                else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
                //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
                else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
                else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
                else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
                else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
                else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
                else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
                else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
                else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
                else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
                else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
                else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
                else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
                else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
                else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
                else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
                else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
                else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
                else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
                else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
                else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
                else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
                else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
                else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
                else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
                else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
                else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
                else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
                else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
                else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
                else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
                else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
                //TE
                else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
                else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
                else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
                else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
                else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
                else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
                else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
                else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
                else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
                else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
                else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
                else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
                else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
                else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
                else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
                else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
                else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
                else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
                else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
                else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
                else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
                else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
                else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
                else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
                else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
                else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
                else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
                else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
                else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
                else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
                else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
                else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
                else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
                else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
                else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
                else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
                else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
                else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
                else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
                else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
                else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
                else { area = "N/A" }

                document.getElementById("area").value = area;

                let customerPhone = "+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("customerPhone").value = customerPhone;

                let receiverPhone = "+" + document.getElementById("code_3").value + document.getElementById("receiverContact_1").value;
                document.getElementById("receiverPhone").value = receiverPhone;

                if (($('input[name=localCharges]:checked').val() == "Standard Brunei-Muara")) {
                    if (document.getElementById("productweight").value <= 3) {
                        document.getElementById("price").value = (5).toFixed(2)
                        document.getElementById('Total-Item-Price').value = (5).toFixed(2)
                    } else {
                        document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 5).toFixed(2)
                        document.getElementById('Total-Item-Price').value = Number(((document.getElementById("productweight").value) - 3) + 5).toFixed(2)
                    }

                    if (moment().format('h') < 12) {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(2, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(3, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=localCharges]:checked').val() == "Standard Tutong")) {
                    if (document.getElementById("productweight").value <= 3) {
                        document.getElementById("price").value = (8).toFixed(2)
                        document.getElementById('Total-Item-Price').value = (8).toFixed(2)
                    } else {
                        document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 8).toFixed(2)
                        document.getElementById('Total-Item-Price').value = Number(((document.getElementById("productweight").value) - 3) + 8).toFixed(2)
                    }
                    if (moment().format('h') < 12) {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(2, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(3, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=localCharges]:checked').val() == "Standard Belait")) {
                    if (document.getElementById("productweight").value <= 3) {
                        document.getElementById("price").value = (15).toFixed(2)
                        document.getElementById('Total-Item-Price').value = (15).toFixed(2)
                    } else {
                        document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 15).toFixed(2)
                        document.getElementById('Total-Item-Price').value = Number(((document.getElementById("productweight").value) - 3) + 15).toFixed(2)
                    }
                    if (moment().format('h') < 12) {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(2, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(3, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=localCharges]:checked').val() == "Standard Temburong")) {
                    if (document.getElementById("productweight").value <= 3) {
                        document.getElementById("price").value = (15).toFixed(2)
                        document.getElementById('Total-Item-Price').value = (15).toFixed(2)
                    } else {
                        document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 15).toFixed(2)
                        document.getElementById('Total-Item-Price').value = Number(((document.getElementById("productweight").value) - 3) + 15).toFixed(2)
                    }
                    if (moment().format('h') < 12) {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(2, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(3, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(4, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=localCharges]:checked').val() == "Express Brunei Muara")) {
                    if (document.getElementById("productweight").value <= 3) {
                        document.getElementById("price").value = (7).toFixed(2)
                        document.getElementById('Total-Item-Price').value = (7).toFixed(2)
                    } else {
                        document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 7).toFixed(2)
                        document.getElementById('Total-Item-Price').value = Number(((document.getElementById("productweight").value) - 3) + 7).toFixed(2)
                    }
                    if (moment().format('h') < 12) {
                        if (moment().format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=localCharges]:checked').val() == "Express Joybean")) {
                    document.getElementById("price").value = (6).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (6).toFixed(2)
                    if (moment().format('h') < 12) {
                        if (moment().format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }

                    $('input[name=products][value="localdeliveryjb"]').prop('checked', true);
                }

                if (($('input[name=localCharges]:checked').val() == "Drop off Brunei Muara")) {
                    if (document.getElementById("productweight").value <= 3) {
                        document.getElementById("price").value = (4).toFixed(2)
                        document.getElementById('Total-Item-Price').value = (4).toFixed(2)
                    } else {
                        document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 4).toFixed(2)
                        document.getElementById('Total-Item-Price').value = Number(((document.getElementById("productweight").value) - 3) + 4).toFixed(2)
                    }
                    if (moment().format('h') < 12) {
                        if (moment().format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=localCharges]:checked').val() == "Drop off Tutong")) {
                    if (document.getElementById("productweight").value <= 3) {
                        document.getElementById("price").value = (6).toFixed(2)
                        document.getElementById('Total-Item-Price').value = (6).toFixed(2)
                    } else {
                        document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 6).toFixed(2)
                        document.getElementById('Total-Item-Price').value = Number(((document.getElementById("productweight").value) - 3) + 6).toFixed(2)
                    }
                    if (moment().format('h') < 12) {
                        if (moment().format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                if (($('input[name=localCharges]:checked').val() == "Drop off Belait")) {
                    if (document.getElementById("productweight").value <= 3) {
                        document.getElementById("price").value = (8).toFixed(2)
                        document.getElementById('Total-Item-Price').value = (8).toFixed(2)
                    } else {
                        document.getElementById('price').value = Number(((document.getElementById("productweight").value) - 3) + 8).toFixed(2)
                        document.getElementById('Total-Item-Price').value = Number(((document.getElementById("productweight").value) - 3) + 8).toFixed(2)
                    }
                    if (moment().format('h') < 12) {
                        if (moment().format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    } else {
                        if (moment().add(1, 'days').format('d') == 0) {
                            document.getElementById("deliveryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(2, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(3, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        } else {
                            document.getElementById("deliveryDate").value = moment().add(1, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbServiceDate").value = moment().add(1, 'days').format('DD/MM/YYYY');
                            document.getElementById("expiryDate").value = moment().add(2, 'days').format('YYYY-MM-DD');
                            document.getElementById("qbExpiryDate").value = moment().add(7, 'days').format('MM/DD/YYYY');
                        }
                    }
                }

                document.getElementById("deliveryType").value = $('input[name=localCharges]:checked').val();

                $('#submitBtnfinal').attr('disabled', false);

                document.getElementById('submitBtnfinal').click()
            }

            if ($('input[name=products]:checked').val() == "cbsl") {
                document.getElementById("receiverName").value = document.getElementById("name").value;
                document.getElementById("receiverEmail").value = document.getElementById("email").value;
                document.getElementById("receiverPhone").value = document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("grpTrack").value = document.getElementById("GB-RS-Track").value;
                document.getElementById("ecommerce").value = document.getElementById("GB-RS-Courier").value;
                document.getElementById("productdescription").value = document.getElementById("gbrsItemDescription").value;
                document.getElementById("itemQuantity").value = document.getElementById("GB-RS-Quantity").value;
                document.getElementById("cargoPrice").value = "RM " + document.getElementById("GB-RS-Total-Amount").value;

                let customerAddress = document.getElementById("house").value + " " + document.getElementById("kampong").value
                    + " " + document.getElementById("jalan").value + " " + document.getElementById("simpang").value + " " + document.getElementById("district").value + " "
                    + document.getElementById("postal").value;

                document.getElementById("customerAddress").value = customerAddress;
                document.getElementById("receiverAddress").value = customerAddress;

                let address = customerAddress.toUpperCase();
                var kampong = "";

                if (address.includes("MANGGIS") == true) { area = "B1", kampong = "MANGGIS" }
                else if (address.includes("DELIMA") == true) { area = "B1", kampong = "DELIMA" }
                else if (address.includes("ANGGREK DESA") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("ANGGREK") == true) { area = "B1", kampong = "ANGGREK DESA" }
                else if (address.includes("PULAIE") == true) { area = "B1", kampong = "PULAIE" }
                else if (address.includes("LAMBAK") == true) { area = "B1", kampong = "LAMBAK" }
                else if (address.includes("TERUNJING") == true) { area = "B1", kampong = "TERUNJING" }
                else if (address.includes("MADANG") == true) { area = "B1", kampong = "MADANG" }
                else if (address.includes("AIRPORT") == true) { area = "B1", kampong = "AIRPORT" }
                else if (address.includes("ORANG KAYA BESAR IMAS") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("OKBI") == true) { area = "B1", kampong = "OKBI" }
                else if (address.includes("SERUSOP") == true) { area = "B1", kampong = "SERUSOP" }
                else if (address.includes("BURONG PINGAI") == true) { area = "B1", kampong = "BURONG PINGAI" }
                else if (address.includes("SETIA NEGARA") == true) { area = "B1", kampong = "SETIA NEGARA" }
                else if (address.includes("PASIR BERAKAS") == true) { area = "B1", kampong = "PASIR BERAKAS" }
                else if (address.includes("MENTERI BESAR") == true) { area = "B1", kampong = "MENTERI BESAR" }
                else if (address.includes("KEBANGSAAN LAMA") == true) { area = "B1", kampong = "KEBANGSAAN LAMA" }
                else if (address.includes("BATU MARANG") == true) { area = "B2", kampong = "BATU MARANG" }
                else if (address.includes("DATO GANDI") == true) { area = "B2", kampong = "DATO GANDI" }
                else if (address.includes("KAPOK") == true) { area = "B2", kampong = "KAPOK" }
                else if (address.includes("KOTA BATU") == true) { area = "B2", kampong = "KOTA BATU" }
                else if (address.includes("MENTIRI") == true) { area = "B2", kampong = "MENTIRI" }
                else if (address.includes("MERAGANG") == true) { area = "B2", kampong = "MERAGANG" }
                else if (address.includes("PELAMBAIAN") == true) { area = "B2", kampong = "PELAMBAIAN" }
                else if (address.includes("PINTU MALIM") == true) { area = "B2", kampong = "PINTU MALIM" }
                else if (address.includes("SALAMBIGAR") == true) { area = "B2", kampong = "SALAMBIGAR" }
                else if (address.includes("SALAR") == true) { area = "B2", kampong = "SALAR" }
                else if (address.includes("SERASA") == true) { area = "B2", kampong = "SERASA" }
                else if (address.includes("SERDANG") == true) { area = "B2", kampong = "SERDANG" }
                else if (address.includes("SUNGAI BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SG BASAR") == true) { area = "B2", kampong = "SUNGAI BASAR" }
                else if (address.includes("SUNGAI BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SG BELUKUT") == true) { area = "B2", kampong = "SUNGAI BELUKUT" }
                else if (address.includes("SUNGAI HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SG HANCHING") == true) { area = "B2", kampong = "SUNGAI HANCHING" }
                else if (address.includes("SUNGAI TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SG TILONG") == true) { area = "B2", kampong = "SUNGAI TILONG" }
                else if (address.includes("SUBOK") == true) { area = "B2", kampong = "SUBOK" }
                else if (address.includes("SUNGAI AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SG AKAR") == true) { area = "B2", kampong = "SUNGAI AKAR" }
                else if (address.includes("SUNGAI BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("SG BULOH") == true) { area = "B2", kampong = "SUNGAI BULOH" }
                else if (address.includes("TANAH JAMBU") == true) { area = "B2", kampong = "TANAH JAMBU" }
                else if (address.includes("SUNGAI OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("SG OROK") == true) { area = "B2", kampong = "SUNGAI OROK" }
                else if (address.includes("KATOK") == true) { area = "G1", kampong = "KATOK" }
                else if (address.includes("MATA-MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("MATA MATA") == true) { area = "G1", kampong = "MATA-MATA" }
                else if (address.includes("RIMBA") == true) { area = "G1", kampong = "RIMBA" }
                else if (address.includes("TUNGKU") == true) { area = "G1", kampong = "TUNGKU" }
                else if (address.includes("UBD") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("UNIVERSITI BRUNEI DARUSSALAM") == true) { area = "G1", kampong = "UBD" }
                else if (address.includes("JIS") == true) { area = "G1" }
                else if (address.includes("JERUDONG INTERNATIONAL SCHOOL") == true) { area = "G1", kampong = "JIS" }
                else if (address.includes("BERANGAN") == true) { area = "G2", kampong = "BERANGAN" }
                else if (address.includes("BERIBI") == true) { area = "G2", kampong = "BERIBI" }
                else if (address.includes("KIULAP") == true) { area = "G2", kampong = "KIULAP" }
                else if (address.includes("RIPAS") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("RAJA ISTERI PENGIRAN ANAK SALLEHA") == true) { area = "G2", kampong = "RIPAS" }
                else if (address.includes("KIARONG") == true) { area = "G2", kampong = "KIARONG" }
                else if (address.includes("PUSAR ULAK") == true) { area = "G2", kampong = "PUSAR ULAK" }
                else if (address.includes("KUMBANG PASANG") == true) { area = "G2", kampong = "KUMBANG PASANG" }
                else if (address.includes("MENGLAIT") == true) { area = "G2", kampong = "MENGLAIT" }
                else if (address.includes("MABOHAI") == true) { area = "G2", kampong = "MABOHAI" }
                else if (address.includes("ONG SUM PING") == true) { area = "G2", kampong = "ONG SUM PING" }
                else if (address.includes("GADONG") == true) { area = "G2", kampong = "GADONG" }
                else if (address.includes("TASEK LAMA") == true) { area = "G2", kampong = "TASEK LAMA" }
                else if (address.includes("BANDAR TOWN") == true) { area = "G2", kampong = "BANDAR TOWN" }
                else if (address.includes("BATU SATU") == true) { area = "JT1", kampong = "BATU SATU" }
                else if (address.includes("BENGKURONG") == true) { area = "JT1", kampong = "BENGKURONG" }
                else if (address.includes("BUNUT") == true) { area = "JT1", kampong = "BUNUT" }
                else if (address.includes("JALAN BABU RAJA") == true) { area = "JT1", kampong = "JALAN BABU RAJA" }
                else if (address.includes("JALAN ISTANA") == true) { area = "JT1", kampong = "JALAN ISTANA" }
                else if (address.includes("JUNJONGAN") == true) { area = "JT1", kampong = "JUNJONGAN" }
                else if (address.includes("KASAT") == true) { area = "JT1", kampong = "KASAT" }
                else if (address.includes("LUMAPAS") == true) { area = "JT1", kampong = "LUMAPAS" }
                else if (address.includes("JALAN HALUS") == true) { area = "JT1", kampong = "JALAN HALUS" }
                else if (address.includes("MADEWA") == true) { area = "JT1", kampong = "MADEWA" }
                else if (address.includes("PUTAT") == true) { area = "JT1", kampong = "PUTAT" }
                else if (address.includes("SINARUBAI") == true) { area = "JT1", kampong = "SINARUBAI" }
                else if (address.includes("TASEK MERADUN") == true) { area = "JT1", kampong = "TASEK MERADUN" }
                else if (address.includes("TELANAI") == true) { area = "JT1", kampong = "TELANAI" }
                else if (address.includes("BAN 1") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 2") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 3") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 4") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 5") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BAN 6") == true) { area = "JT2", kampong = "BAN" }
                else if (address.includes("BATONG") == true) { area = "JT2", kampong = "BATONG" }
                else if (address.includes("BATU AMPAR") == true) { area = "JT2", kampong = "BATU AMPAR" }
                else if (address.includes("BEBATIK") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("BEBULOH") == true) { area = "JT2", kampong = "BEBULOH" }
                else if (address.includes("BEBATIK KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("KILANAS") == true) { area = "JT2", kampong = "BEBATIK KILANAS" }
                else if (address.includes("DADAP") == true) { area = "JT2", kampong = "DADAP" }
                else if (address.includes("KUALA LURAH") == true) { area = "JT2", kampong = "KUALA LURAH" }
                else if (address.includes("KULAPIS") == true) { area = "JT2", kampong = "KULAPIS" }
                else if (address.includes("LIMAU MANIS") == true) { area = "JT2", kampong = "LIMAU MANIS" }
                else if (address.includes("MASIN") == true) { area = "JT2", kampong = "MASIN" }
                else if (address.includes("MULAUT") == true) { area = "JT2", kampong = "MULAUT" }
                else if (address.includes("PANCHOR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANCHUR MURAI") == true) { area = "JT2", kampong = "PANCHOR MURAI" }
                else if (address.includes("PANGKALAN BATU") == true) { area = "JT2", kampong = "PANGKALAN BATU" }
                else if (address.includes("PASAI") == true) { area = "JT2", kampong = "PASAI" }
                else if (address.includes("WASAN") == true) { area = "JT2", kampong = "WASAN" }
                else if (address.includes("PARIT") == true) { area = "JT2", kampong = "PARIT" }
                else if (address.includes("EMPIRE") == true) { area = "JT3", kampong = "EMPIRE" }
                else if (address.includes("JANGSAK") == true) { area = "JT3", kampong = "JANGSAK" }
                else if (address.includes("JERUDONG") == true) { area = "JT3", kampong = "JERUDONG" }
                else if (address.includes("KATIMAHAR") == true) { area = "JT3", kampong = "KATIMAHAR" }
                else if (address.includes("LUGU") == true) { area = "JT3", kampong = "LUGU" }
                else if (address.includes("SENGKURONG") == true) { area = "JT3", kampong = "SENGKURONG" }
                else if (address.includes("TANJONG NANGKA") == true) { area = "JT3", kampong = "TANJONG NANGKA" }
                else if (address.includes("TANJONG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("TANJUNG BUNUT") == true) { area = "JT3", kampong = "TANJONG BUNUT" }
                else if (address.includes("SUNGAI TAMPOI") == true) { area = "JT3", kampung = "SUNGAI TAMPOI" }
                else if (address.includes("SG TAMPOI") == true) { area = "JT3", kampong = "SUNGAI TAMPOI" }
                else if (address.includes("MUARA") == true) { area = "B2", kampong = "MUARA" }
                //TU
                else if (address.includes("SENGKARAI") == true) { area = "TUTONG", kampong = "SENGKARAI" }
                else if (address.includes("PANCHOR") == true) { area = "TUTONG", kampong = "PANCHOR" }
                else if (address.includes("PENABAI") == true) { area = "TUTONG", kampong = "PENABAI" }
                else if (address.includes("KUALA TUTONG") == true) { area = "TUTONG", kampong = "KUALA TUTONG" }
                else if (address.includes("PENANJONG") == true) { area = "TUTONG", kampong = "PENANJONG" }
                else if (address.includes("KERIAM") == true) { area = "TUTONG", kampong = "KERIAM" }
                else if (address.includes("BUKIT PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("PANGGAL") == true) { area = "TUTONG", kampong = "BUKIT PANGGAL" }
                else if (address.includes("LUAGAN") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("LUAGAN DUDOK") == true) { area = "TUTONG", kampong = "LUAGAN DUDOK" }
                else if (address.includes("SINAUT") == true) { area = "TUTONG", kampong = "SINAUT" }
                else if (address.includes("SUNGAI KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("SG KELUGOS") == true) { area = "TUTONG", kampong = "SUNGAI KELUGOS" }
                else if (address.includes("KUPANG") == true) { area = "TUTONG", kampong = "KUPANG" }
                else if (address.includes("KIUDANG") == true) { area = "TUTONG", kampong = "KIUDANG" }
                else if (address.includes("PAD") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("PAD NUNOK") == true) { area = "TUTONG", kampong = "PAD NUNOK" }
                else if (address.includes("BEKIAU") == true) { area = "TUTONG", kampong = "BEKIAU" }
                else if (address.includes("MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("PENGKALAN MAU") == true) { area = "TUTONG", kampong = "PENGKALAN MAU" }
                else if (address.includes("BATANG MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("MITUS") == true) { area = "TUTONG", kampong = "BATANG MITUS" }
                else if (address.includes("KEBIA") == true) { area = "TUTONG", kampong = "KEBIA" }
                else if (address.includes("BIRAU") == true) { area = "TUTONG", kampong = "BIRAU" }
                else if (address.includes("LAMUNIN") == true) { area = "TUTONG", kampong = "LAMUNIN" }
                else if (address.includes("LAYONG") == true) { area = "TUTONG", kampong = "LAYONG" }
                else if (address.includes("MENENGAH") == true) { area = "TUTONG", kampong = "MENENGAH" }
                else if (address.includes("PANCHONG") == true) { area = "TUTONG", kampong = "PANCHONG" }
                else if (address.includes("PENAPAR") == true) { area = "TUTONG", kampong = "PANAPAR" }
                else if (address.includes("TANJONG MAYA") == true) { area = "TUTONG", kampong = "TANJONG MAYA" }
                else if (address.includes("MAYA") == true) { area = "TUTONG", kampong = "MAYA" }
                else if (address.includes("LUBOK") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("LUBOK PULAU") == true) { area = "TUTONG", kampong = "LUBOK PULAU" }
                else if (address.includes("BUKIT UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("UDAL") == true) { area = "TUTONG", kampong = "BUKIT UDAL" }
                else if (address.includes("RAMBAI") == true) { area = "TUTONG", kampong = "RAMBAI" }
                else if (address.includes("BENUTAN") == true) { area = "TUTONG", kampong = "BENUTAN" }
                else if (address.includes("MERIMBUN") == true) { area = "TUTONG", kampong = "MERIMBUN" }
                else if (address.includes("UKONG") == true) { area = "TUTONG", kampong = "UKONG" }
                else if (address.includes("LONG") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("LONG MAYAN") == true) { area = "TUTONG", kampong = "LONG MAYAN" }
                else if (address.includes("TELISAI") == true) { area = "TUTONG", kampong = "TELISAI" }
                else if (address.includes("DANAU") == true) { area = "TUTONG", kampong = "DANAU" }
                else if (address.includes("BUKIT BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("BERUANG") == true) { area = "TUTONG", kampong = "BUKIT BERUANG" }
                else if (address.includes("TUTONG") == true) { area = "TUTONG", kampong = "TUTONG" }
                //KB
                else if (address.includes("AGIS") == true) { area = "LUMUT", kampong = "AGIS" }
                else if (address.includes("ANDALAU") == true) { area = "LUMUT", kampong = "ANDALAU" }
                else if (address.includes("ANDUKI") == true) { area = "LUMUT", kampong = "ANDUKI" }
                else if (address.includes("APAK") == true) { area = "KB / SERIA", kampong = "APAK" }
                else if (address.includes("BADAS") == true) { area = "LUMUT", kampong = "BADAS" }
                else if (address.includes("BANG") == true) { area = "KB / SERIA", kampong = "BANG" }
                else if (address.includes("GARANG") == true) { area = "KB / SERIA", kampong = "GARANG" }
                else if (address.includes("PUKUL") == true) { area = "KB / SERIA", kampong = "PUKUL" }
                else if (address.includes("TAJUK") == true) { area = "KB / SERIA", kampong = "TAJUK" }
                else if (address.includes("BENGERANG") == true) { area = "KB / SERIA", kampong = "BENGERANG" }
                else if (address.includes("BIADONG") == true) { area = "KB / SERIA", kampong = "BIADONG" }
                else if (address.includes("ULU") == true) { area = "KB / SERIA", kampong = "ULU" }
                else if (address.includes("TENGAH") == true) { area = "KB / SERIA", kampong = "TENGAH" }
                else if (address.includes("BISUT") == true) { area = "KB / SERIA", kampong = "BISUT" }
                else if (address.includes("BUAU") == true) { area = "KB / SERIA", kampong = "BUAU" }
                else if (address.includes("KANDOL") == true) { area = "KB / SERIA", kampong = "KANDOL" }
                else if (address.includes("PUAN") == true) { area = "KB / SERIA", kampong = "PUAN" }
                else if (address.includes("TUDING") == true) { area = "LUMUT", kampong = "TUDING" }
                else if (address.includes("SAWAT") == true) { area = "KB / SERIA", kampong = "SAWAT" }
                else if (address.includes("SERAWONG") == true) { area = "KB / SERIA", kampong = "SERAWONG" }
                else if (address.includes("CHINA") == true) { area = "KB / SERIA", kampong = "CHINA" }
                else if (address.includes("DUGUN") == true) { area = "KB / SERIA", kampong = "DUGUN" }
                else if (address.includes("GATAS") == true) { area = "KB / SERIA", kampong = "GATAS" }
                else if (address.includes("JABANG") == true) { area = "KB / SERIA", kampong = "JABANG" }
                else if (address.includes("KAGU") == true) { area = "KB / SERIA", kampong = "KAGU" }
                else if (address.includes("KAJITAN") == true) { area = "KB / SERIA", kampong = "KAJITAN" }
                else if (address.includes("KELUYOH") == true) { area = "KB / SERIA", kampong = "KELUYOH" }
                else if (address.includes("KENAPOL") == true) { area = "KB / SERIA", kampong = "KENAPOL" }
                else if (address.includes("KUALA BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("BALAI") == true) { area = "KB", kampong = "KUALA BALAI" }
                else if (address.includes("KUALA BELAIT") == true) { area = "KB", kampong = "KUALA BELAIT" }
                else if (address.includes("KUKUB") == true) { area = "KB / SERIA", kampong = "KUKUB" }
                else if (address.includes("LABI") == true) { area = "LUMUT", kampong = "LABI" }
                else if (address.includes("LAKANG") == true) { area = "KB / SERIA", kampong = "LAKANG" }
                else if (address.includes("LAONG ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("ARUT") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LAONG") == true) { area = "KB / SERIA", kampong = "LAONG ARUT" }
                else if (address.includes("LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SUNGAI LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("SG LIANG") == true) { area = "LUMUT", kampong = "SUNGAI LIANG" }
                else if (address.includes("LUMUT") == true) { area = "LUMUT", kampong = "LUMUT" }
                else if (address.includes("LORONG") == true) { area = "SERIA", kampong = "LORONG" }
                else if (address.includes("LORONG TENGAH") == true) { area = "SERIA", kampong = "LORONG TENGAH" }
                else if (address.includes("LORONG TIGA SELATAN") == true) { area = "SERIA", kampong = "LORONG TIGA SELATAN" }
                else if (address.includes("LILAS") == true) { area = "KB / SERIA", kampong = "LILAS" }
                else if (address.includes("LUBUK LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LANYAP") == true) { area = "KB / SERIA", kampong = "LUBUK LANYAP" }
                else if (address.includes("LUBUK TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("TAPANG") == true) { area = "KB / SERIA", kampong = "LUBUK TAPANG" }
                else if (address.includes("MALA'AS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAAS") == true) { area = "KB / SERIA", kampong = "MALA'AS" }
                else if (address.includes("MALAYAN") == true) { area = "KB / SERIA", kampong = "MELAYAN" }
                else if (address.includes("MELAYU") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELAYU ASLI") == true) { area = "KB / SERIA", kampong = "MELAYU ASLI" }
                else if (address.includes("MELILAS") == true) { area = "LUMUT", kampong = "MELILAS" }
                else if (address.includes("MENDARAM") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM BESAR") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MENDARAM KECIL") == true) { area = "KB / SERIA", kampong = "MENDARAM" }
                else if (address.includes("MERANGKING") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING ULU") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MERANGKING HILIR") == true) { area = "KB / SERIA", kampong = "MERANGKING" }
                else if (address.includes("MUMONG") == true) { area = "KB", kampong = "MUMONG" }
                else if (address.includes("PANDAN") == true) { area = "KB", kampong = "PANDAN" }
                else if (address.includes("PADANG") == true) { area = "KB", kampong = "PADANG" }
                else if (address.includes("PANAGA") == true) { area = "SERIA", kampong = "PANAGA" }
                else if (address.includes("PENGKALAN SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("SIONG") == true) { area = "KB / SERIA", kampong = "PENGKALAN SIONG" }
                else if (address.includes("PENGALAYAN") == true) { area = "KB / SERIA", kampong = "PENGALAYAN" }
                else if (address.includes("PENYRAP") == true) { area = "KB / SERIA", kampong = "PENYRAP" }
                else if (address.includes("PERANGKONG") == true) { area = "KB / SERIA", kampong = "PERANGKONG" }
                else if (address.includes("PERUMPONG") == true) { area = "LUMUT", kampong = "PERUMPONG" }
                else if (address.includes("PESILIN") == true) { area = "KB / SERIA", kampong = "PESILIN" }
                else if (address.includes("PULAU APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("APIL") == true) { area = "KB / SERIA", kampong = "PULAU APIL" }
                else if (address.includes("RAMPAYOH") == true) { area = "KB / SERIA", kampong = "RAMPAYOH" }
                else if (address.includes("RATAN") == true) { area = "KB / SERIA", kampong = "RATAN" }
                else if (address.includes("SAUD") == true) { area = "KB / SERIA", kampong = "SAUD" }
                //else if (address.includes("SIMPANG") == true) {area = "KB / SERIA", kampong = "SIMPANG TIGA"}
                else if (address.includes("SIMPANG TIGA") == true) { area = "LUMUT", kampong = "SIMPANG TIGA" }
                else if (address.includes("SINGAP") == true) { area = "KB / SERIA", kampong = "SINGAP" }
                else if (address.includes("SUKANG") == true) { area = "KB / SERIA", kampong = "SUKANG" }
                else if (address.includes("BAKONG") == true) { area = "LUMUT", kampong = "BAKONG" }
                else if (address.includes("DAMIT") == true) { area = "KB / SERIA", kampong = "DAMIT" }
                else if (address.includes("BERA") == true) { area = "KB / SERIA", kampong = "BERA" }
                else if (address.includes("DUHON") == true) { area = "KB / SERIA", kampong = "DUHON" }
                else if (address.includes("GANA") == true) { area = "LUMUT", kampong = "GANA" }
                else if (address.includes("HILIR") == true) { area = "KB / SERIA", kampong = "HILIR" }
                else if (address.includes("KANG") == true) { area = "LUMUT", kampong = "KANG" }
                else if (address.includes("KURU") == true) { area = "LUMUT", kampong = "KURU" }
                else if (address.includes("LALIT") == true) { area = "LUMUT", kampong = "LALIT" }
                else if (address.includes("LUTONG") == true) { area = "KB / SERIA", kampong = "LUTONG" }
                else if (address.includes("MAU") == true) { area = "KB / SERIA", kampong = "MAU" }
                else if (address.includes("MELILIT") == true) { area = "KB / SERIA", kampong = "MELILIT" }
                else if (address.includes("PETAI") == true) { area = "KB / SERIA", kampong = "PETAI" }
                else if (address.includes("TALI") == true) { area = "LUMUT", kampong = "TALI" }
                else if (address.includes("TARING") == true) { area = "LUMUT", kampong = "TARING" }
                else if (address.includes("TERABAN") == true) { area = "KB", kampong = "TERABAN" }
                else if (address.includes("UBAR") == true) { area = "KB / SERIA", kampong = "UBAR" }
                else if (address.includes("TANAJOR") == true) { area = "KB / SERIA", kampong = "TANAJOR" }
                else if (address.includes("TANJONG RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("RANGGAS") == true) { area = "KB / SERIA", kampong = "TANJONG RANGGAS" }
                else if (address.includes("TANJONG SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("SUDAI") == true) { area = "KB / SERIA", kampong = "TANJONG SUDAI" }
                else if (address.includes("TAPANG LUPAK") == true) { area = "KB / SERIA", kampong = "TAPANG LUPAK" }
                else if (address.includes("TARAP") == true) { area = "KB / SERIA", kampong = "TARAP" }
                else if (address.includes("TEMPINAK") == true) { area = "KB / SERIA", kampong = "TEMPINAK" }
                else if (address.includes("TERAJA") == true) { area = "KB / SERIA", kampong = "TERAJA" }
                else if (address.includes("TERAWAN") == true) { area = "KB / SERIA", kampong = "TERAWAN" }
                else if (address.includes("TERUNAN") == true) { area = "KB / SERIA", kampong = "TERUNAN" }
                else if (address.includes("TUGONG") == true) { area = "KB / SERIA", kampong = "TUGONG" }
                else if (address.includes("TUNGULLIAN") == true) { area = "LUMUT", kampong = "TUNGULLIAN" }
                else if (address.includes("UBOK") == true) { area = "KB / SERIA", kampong = "UBOK" }
                else if (address.includes("BELAIT") == true) { area = "KB / SERIA", kampong = "BELAIT" }
                //TE
                else if (address.includes("AMO") == true) { area = "TEMBURONG", kampong = "AMO" }
                else if (address.includes("AYAM-AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("AYAM AYAM") == true) { area = "TEMBURONG", kampong = "AYAM-AYAM" }
                else if (address.includes("BAKARUT") == true) { area = "TEMBURONG", kampong = "BAKARUT" }
                else if (address.includes("BATANG DURI") == true) { area = "TEMBURONG", kampong = "BATANG DURI" }
                else if (address.includes("BATANG TUAU") == true) { area = "TEMBURONG", kampong = "BATANG TUAU" }
                else if (address.includes("BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("BATU BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BEJARAH") == true) { area = "TEMBURONG", kampong = "BATU BEJARAH" }
                else if (address.includes("BELABAN") == true) { area = "TEMBURONG", kampong = "BELABAN" }
                else if (address.includes("BELAIS") == true) { area = "TEMBURONG", kampong = "BELAIS" }
                else if (address.includes("BELINGOS") == true) { area = "TEMBURONG", kampong = "BELINGOS" }
                else if (address.includes("BIANG") == true) { area = "TEMBURONG", kampong = "BIANG" }
                else if (address.includes("BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("BUDA BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("BUDA-BUDA") == true) { area = "TEMBURONG", kampong = "BUDA-BUDA" }
                else if (address.includes("GADONG BARU") == true) { area = "TEMBURONG", kampong = "GADONG BARU" }
                else if (address.includes("KENUA") == true) { area = "TEMBURONG", kampong = "KENUA" }
                else if (address.includes("LABU ESTATE") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LABU") == true) { area = "TEMBURONG", kampong = "LABU" }
                else if (address.includes("LAGAU") == true) { area = "TEMBURONG", kampong = "LAGAU" }
                else if (address.includes("LAKIUN") == true) { area = "TEMBURONG", kampong = "LAKIUN" }
                else if (address.includes("LAMALING") == true) { area = "TEMBURONG", kampong = "LAMALING" }
                else if (address.includes("LEPONG") == true) { area = "TEMBURONG", kampong = "LEPONG" }
                else if (address.includes("LUAGAN") == true) { area = "TEMBURONG", kampong = "LUAGAN" }
                else if (address.includes("MANIUP") == true) { area = "TEMBURONG", kampong = "MANIUP" }
                else if (address.includes("MENENGAH") == true) { area = "TEMBURONG", kampong = "MENGENGAH" }
                else if (address.includes("NEGALANG") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG ERING") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("NEGALANG UNAT") == true) { area = "TEMBURONG", kampong = "NEGALANG" }
                else if (address.includes("PARIT") == true) { area = "TEMBURONG", kampong = "PARIT" }
                else if (address.includes("PARIT BELAYANG") == true) { area = "TEMBURONG", kampong = "PARIT BELAYANG" }
                else if (address.includes("PAYAU") == true) { area = "TEMBURONG", kampong = "PAYAU" }
                else if (address.includes("PELIUNAN") == true) { area = "TEMBURONG", kampong = "PELIUNAN" }
                else if (address.includes("PERDAYAN") == true) { area = "TEMBURONG", kampong = "PERDAYAN" }
                else if (address.includes("PIASAU-PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIASAU PIASAU") == true) { area = "TEMBURONG", kampong = "PIASAU-PIASAU" }
                else if (address.includes("PIUNGAN") == true) { area = "TEMBURONG", kampong = "PIUNGAN" }
                else if (address.includes("PUNI") == true) { area = "TEMBURONG", kampong = "PUNI" }
                else if (address.includes("RATAIE") == true) { area = "TEMBURONG", kampong = "RATAIE" }
                else if (address.includes("REBADA") == true) { area = "TEMBURONG", kampong = "REBADA" }
                else if (address.includes("SEKUROP") == true) { area = "TEMBURONG", kampong = "SEKUROP" }
                else if (address.includes("SELANGAN") == true) { area = "TEMBURONG", kampong = "SELANGAN" }
                else if (address.includes("SELAPON") == true) { area = "TEMBURONG", kampong = "SELAPON" }
                else if (address.includes("SEMABAT") == true) { area = "TEMBURONG", kampong = "SEMABAT" }
                else if (address.includes("SEMAMAMNG") == true) { area = "TEMBURONG", kampong = "SEMAMANG" }
                else if (address.includes("SENUKOH") == true) { area = "TEMBURONG", kampong = "SENUKOH" }
                else if (address.includes("SERI TANJONG BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("BELAYANG") == true) { area = "TEMBURONG", kampong = "SERI TANJONG BELAYANG" }
                else if (address.includes("SIBULU") == true) { area = "TEMBURONG", kampong = "SIBULU" }
                else if (address.includes("SIBUT") == true) { area = "TEMBURONG", kampong = "SIBUT" }
                else if (address.includes("SIMBATANG BATU APOI") == true) { area = "TEMBURONG", kampong = "BATU APOI" }
                else if (address.includes("SIMBATANG BOKOK") == true) { area = "TEMBURONG", kampong = "BOKOK" }
                else if (address.includes("SUBOK") == true) { area = "TEMBURONG", kampong = "SUBOK" }
                else if (address.includes("SUMBILING") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING BARU") == true) { area = "TEMBURONG", kampong = "SUMBILING" }
                else if (address.includes("SUMBILING LAMA") == true) { area = "TEMBURONG", kampong = "SUMBILING LAMA" }
                else if (address.includes("SUNGAI RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SG RADANG") == true) { area = "TEMBURONG", kampong = "SUNGAI RADANG" }
                else if (address.includes("SUNGAI SULOK") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SG SULOK ") == true) { area = "TEMBURONG", kampong = "SUNGAI SULOK" }
                else if (address.includes("SUNGAI TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SG TANAM") == true) { area = "TEMBURONG", kampong = "SUNGAI TANAM" }
                else if (address.includes("SUNGAI TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("SG TANIT") == true) { area = "TEMBURONG", kampong = "SUNGAI TANIT" }
                else if (address.includes("TANJONG BUNGAR") == true) { area = "TEMBURONG", kampong = "TANJONG BUNGAR" }
                else if (address.includes("TEMADA") == true) { area = "TEMBURONG", kampong = "TEMADA" }
                else if (address.includes("UJONG JALAN") == true) { area = "TEMBURONG", kampong = "UJONG JALAN" }
                else if (address.includes("BANGAR") == true) { area = "TEMBURONG", kampong = "BANGAR" }
                else if (address.includes("TEMBURONG") == true) { area = "TEMBURONG" }
                else { area = "N/A" }

                document.getElementById("area").value = area;

                var conN = document.getElementById("name").value;
                document.getElementById("buyerName").value = document.getElementById("name").value;

                let customerPhone = "+" + document.getElementById("code").value + document.getElementById("contact_1").value.replace(" ", "");

                document.getElementById("customerPhone").value = customerPhone;

                if (moment().format('h') < 12) {
                    if (moment().add(13, 'days').format('d') == 0) {
                        document.getElementById("deliveryDate").value = moment().add(14, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(14, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(20, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(20, 'days').format('MM/DD/YYYY');


                    } else {
                        document.getElementById("deliveryDate").value = moment().add(13, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(13, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(19, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(19, 'days').format('MM/DD/YYYY');
                    }
                } else {
                    if (moment().add(14, 'days').format('d') == 0) {
                        document.getElementById("deliveryDate").value = moment().add(15, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(15, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(21, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(21, 'days').format('MM/DD/YYYY');
                    } else {
                        document.getElementById("deliveryDate").value = moment().add(14, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbServiceDate").value = moment().add(14, 'days').format('DD/MM/YYYY');
                        document.getElementById("expiryDate").value = moment().add(20, 'days').format('YYYY-MM-DD');
                        document.getElementById("qbExpiryDate").value = moment().add(20, 'days').format('MM/DD/YYYY');
                    }
                }

                if ($('input[name=pickupordeliverycbsl]:checked').val() == "pickup") {
                    document.getElementById("deliveryType").value = "Pickup"
                } else {
                    document.getElementById("deliveryType").value = $('input[name=cbslCharges]:checked').val();
                }

                if (($('input[name=cbslCharges]:checked').val() == "Immediate Brunei Muara")) {
                    document.getElementById("price").value = (20).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (20).toFixed(2)

                }

                if (($('input[name=cbslCharges]:checked').val() == "Drop off Brunei Muara")) {
                    document.getElementById("price").value = (4).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (4).toFixed(2)

                }

                if (($('input[name=cbslCharges]:checked').val() == "Drop off Tutong")) {
                    document.getElementById("price").value = (6).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (6).toFixed(2)
                }

                if (($('input[name=cbslCharges]:checked').val() == "Drop off Belait")) {
                    document.getElementById("price").value = (8).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (8).toFixed(2)
                }

                if (($('input[name=cbslCharges]:checked').val() == "Drop off Temburong")) {
                    document.getElementById("price").value = (11).toFixed(2)
                    document.getElementById('Total-Item-Price').value = (11).toFixed(2)
                }

                $('#submitBtnfinal').attr('disabled', false);

                document.getElementById('submitBtnfinal').click();
            }
        });
    });
});