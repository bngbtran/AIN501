// ============================================================
// API
// ============================================================

const API_URL = "http://localhost:8000/predict";


// ============================================================
// UPLOAD IMAGE & PREDICT
// ============================================================

async function uploadImage() {

    const fileInput =
        document.getElementById("imageInput");

    if (!fileInput || fileInput.files.length === 0) {
        alert("Vui lòng chọn một ảnh trước.");
        return;
    }

    const file = fileInput.files[0];


    // ========================================================
    // ELEMENTS
    // ========================================================

    const comparisonSection =
        document.getElementById("comparisonSection");

    const resultContainer =
        document.getElementById("resultContainer");

    const outputImage =
        document.getElementById("outputImage");

    const resultPlaceholder =
        document.getElementById("resultPlaceholder");

    const resultStatus =
        document.getElementById("resultStatus");

    const loading =
        document.getElementById("loading");

    const detectButton =
        document.getElementById("detectButton");

    const detectionContainer =
        document.getElementById("detectionResults");

    const summaryContainer =
        document.getElementById("detectionSummary");


    // ========================================================
    // FORM DATA
    // ========================================================

    const formData = new FormData();

    formData.append("file", file);


    try {

        // ====================================================
        // SHOW COMPARISON AREA
        // ====================================================

        if (comparisonSection) {
            comparisonSection.classList.remove("hidden");
        }


        // ====================================================
        // LOADING STATE
        // ====================================================

        if (loading) {
            loading.classList.remove("hidden");
        }

        if (detectButton) {
            detectButton.disabled = true;
            detectButton.textContent = "Đang nhận diện...";
        }


        // Xóa kết quả cũ

        if (outputImage) {
            outputImage.src = "";
            outputImage.classList.add("hidden");
        }

        if (resultPlaceholder) {
            resultPlaceholder.classList.remove("hidden");
            resultPlaceholder.textContent =
                "Đang phân tích ảnh...";
        }

        if (resultContainer) {
            resultContainer.classList.add("hidden");
        }

        if (resultStatus) {
            resultStatus.classList.add("hidden");
        }

        if (detectionContainer) {
            detectionContainer.innerHTML = "";
        }

        if (summaryContainer) {
            summaryContainer.innerHTML = "";
        }


        // ====================================================
        // CALL BACKEND
        // ====================================================

        console.log("Sending image to:", API_URL);

        const response = await fetch(
            API_URL,
            {
                method: "POST",
                body: formData
            }
        );


        // ====================================================
        // READ RESPONSE
        // ====================================================

        const data = await response.json();

        console.log("Backend response:", data);


        // ====================================================
        // CHECK ERROR
        // ====================================================

        if (!response.ok || !data.success) {

            throw new Error(
                data.error ||
                "Backend prediction failed."
            );
        }


        // ====================================================
        // DISPLAY RESULT IMAGE
        // ====================================================

        if (
            data.image &&
            data.image.data_url &&
            outputImage
        ) {

            outputImage.src =
                data.image.data_url;

            outputImage.alt =
                "Ảnh kết quả nhận diện";

            // QUAN TRỌNG:
            // HTML ban đầu đặt ảnh là hidden.
            // Phải bỏ hidden sau khi backend trả kết quả.

            outputImage.classList.remove(
                "hidden"
            );


            // Ẩn placeholder

            if (resultPlaceholder) {
                resultPlaceholder.classList.add(
                    "hidden"
                );
            }


            // Khi ảnh load xong

            outputImage.onload = function () {

                console.log(
                    "Result image displayed successfully."
                );

            };

        } else {

            throw new Error(
                "Backend không trả về ảnh kết quả."
            );
        }


        // ====================================================
        // RESULT STATUS
        // ====================================================

        if (resultStatus) {

            resultStatus.textContent =
                "✓ Hoàn tất";

            resultStatus.classList.remove(
                "hidden"
            );
        }


        // ====================================================
        // SUMMARY
        // ====================================================

        const total =
            data.summary?.total ?? 0;

        const classCounts =
            data.summary?.class_counts || {};


        if (summaryContainer) {

            let html = `
                <div>
                    <div
                        class="text-2xl
                               font-semibold
                               text-gray-800"
                    >
                        ${total}
                    </div>

                    <div
                        class="text-xs
                               text-gray-400
                               mt-1"
                    >
                        đối tượng được phát hiện
                    </div>
                </div>
            `;

            summaryContainer.innerHTML = html;
        }


        // ====================================================
        // DETECTION DETAILS
        // ====================================================

        if (detectionContainer) {

            const detections =
                Array.isArray(data.detections)
                    ? data.detections
                    : [];


            if (detections.length === 0) {

                detectionContainer.innerHTML = `
                    <div
                        class="md:col-span-3
                               border
                               border-gray-200
                               rounded-xl
                               p-6
                               text-center"
                    >
                        <p
                            class="text-sm
                                   text-gray-500"
                        >
                            Không phát hiện hư hỏng
                            mặt đường.
                        </p>
                    </div>
                `;

            } else {

                detections.forEach(
                    (detection, index) => {

                        const className =
                            detection.class ||
                            "Unknown";

                        const confidence =
                            (
                                Number(
                                    detection.confidence
                                ) * 100
                            ).toFixed(1);


                        const item =
                            document.createElement(
                                "div"
                            );

                        item.className =
                            "detection-item p-5";


                        item.innerHTML = `
                            <div
                                class="flex
                                       items-start
                                       justify-between"
                            >

                                <div>

                                    <p
                                        class="text-xs
                                               text-gray-400
                                               mb-1"
                                    >
                                        Detection #${index + 1}
                                    </p>

                                    <h3
                                        class="text-base
                                               font-semibold
                                               text-gray-800"
                                    >
                                        ${className}
                                    </h3>

                                </div>


                                <div
                                    class="text-right"
                                >

                                    <p
                                        class="text-lg
                                               font-semibold
                                               primary"
                                    >
                                        ${confidence}%
                                    </p>

                                    <p
                                        class="text-xs
                                               text-gray-400"
                                    >
                                        confidence
                                    </p>

                                </div>

                            </div>
                        `;


                        detectionContainer.appendChild(
                            item
                        );
                    }
                );
            }
        }


        // ====================================================
        // SHOW RESULT SECTION
        // ====================================================

        if (resultContainer) {
            resultContainer.classList.remove(
                "hidden"
            );
        }


    } catch (error) {

        console.error(
            "Prediction error:",
            error
        );


        if (resultPlaceholder) {

            resultPlaceholder.classList.remove(
                "hidden"
            );

            resultPlaceholder.textContent =
                "Không thể tạo kết quả.";
        }


        alert(
            "Không thể nhận diện ảnh:\n" +
            error.message
        );


    } finally {

        // ====================================================
        // STOP LOADING
        // ====================================================

        if (loading) {
            loading.classList.add("hidden");
        }

        if (detectButton) {

            detectButton.disabled = false;

            detectButton.textContent =
                "Nhận diện";
        }
    }
}