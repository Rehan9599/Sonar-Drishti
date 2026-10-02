# DRISHTI: LinkedIn Posts (6 team members)

One post per person, each told from that person's own part of the project. All facts below come from the repo and the project record; nothing here claims a result we did not measure.

**Before posting**
- Replace `[link]` with the GitHub repo: https://github.com/Rehan9599/Sonar-Drishti
- Hugging Face model: https://huggingface.co/rehan9599/drishti-detector
- Hugging Face dataset: https://huggingface.co/datasets/rehan9599/drishti-sss
- Tag teammates with `@` on LinkedIn (each post lists who to tag). Tag the SIH / organising-body page only if you are sure of the official handle.
- Post **staggered**, one or two a day, not all six at once. Each person puts the repo link in the **first comment**, not the post body (LinkedIn shows posts with outside links to fewer people).
- Add the same 1 image to every post: the dashboard map screenshot or the pipeline flowchart slide. Pipeline flowchart works best for Rehan, Fareed, Faiqa. Dashboard screenshot for Farhan, Faizan. Dataset table slide for Asad.
- Keep the honest numbers. They are the credibility of the whole set.

**Shared hashtags (pick 4-5 each):** #SIH2026 #SmartIndiaHackathon #MachineLearning #SideScanSonar #MarineTech #ComputerVision #YOLOv8 #OceanTech #DeepTech

---

## 0. Rehan (team lead): kickoff post, post this one first

Six of us just submitted our Smart India Hackathon 2026 entry, and I want to spend this week telling the story of what we built, one teammate at a time.

The problem (PS 26057): detect man-made hazards on the seabed (shipwrecks, pipelines, cylinders, ghost nets) from side-scan sonar, give each detection a trustworthy confidence score, filter out false alarms, geotag everything, and put it on a map.

What we built is DRISHTI: calibrated marine debris detection from side-scan sonar.

Raw sonar tile in, geolocated and confidence-scored contact out. A detector, a noise filter, a geotagging engine, a live dashboard, and an edge-deployable ONNX model that runs without PyTorch.

Over the next few days each of us will share our own piece: the physics, the data, the backend, the frontend, the architecture, and the model.

Meet the team:
Rehan, ML training & data
Fareed, research & system architecture
Faiqa, physics & presentation
Farhan, backend
Faizan, frontend
Asad, research & data collection

Code, weights and dataset are all public. Link in the first comment.

#SIH2026 #SmartIndiaHackathon #SideScanSonar #MarineTech #MachineLearning

Tag: Fareed, Faiqa, Farhan, Faizan, Asad

---

## 1. Rehan: ML model training & data work

I trained our sonar detector four different ways. The most useful thing I learned was when to stop.

For our Smart India Hackathon project I led the model and data work. A few things I would tell anyone starting a similar problem:

**1. We pivoted early.** We began with forward-looking sonar and segmentation. It reached a decent score, but we had no real mask labels for the data we actually had. We dropped it and moved to side-scan sonar box detection with YOLOv8s. It cost two days. It was the right call.

**2. We wrote our pass/fail bars before training.** Our rule: if crab_pot (a class we trained on) did not reach 0.25 AP50 after the retrain, we would drop it. It reached 0.19, even after nearly doubling its data. We dropped it, shipped the four classes the problem statement actually names, and moved on without debate.

**3. We tested things and kept the negative results.**
- Lee filter + CLAHE preprocessing: no accuracy gain on a matched test, so we say so.
- INT8 quantization: slower on CPU and accuracy collapsed to zero on every class. Excluded.
- 350 extra synthetic mine images: slightly hurt accuracy.

**4. We kept the test set fixed.** When we once rebuilt it, one class "dropped" from 0.45 to 0.30 AP. The model had not changed; the test set was just harder. Compare runs on the same protocol or the numbers mean nothing.

Where we landed: the pipeline-detection class reaches about 0.98 AP50 on real held-out data. Shipwreck and cylinder detection are weaker, and ghost-net results are synthetic-only because no real public dataset exists. We say that plainly in the deck.

Setting a kill criterion in advance saved us more time than any trick in the training config.

Code, weights and dataset are public: link in the first comment.

#SIH2026 #MachineLearning #YOLOv8 #SideScanSonar #ComputerVision

Tag: the whole team

---

## 2. Fareed: research & system architecture

Our model is a library, not a service. That one decision shaped the whole DRISHTI system.

I handled research and system architecture for our Smart India Hackathon project. Here is how it fit together.

**The idea:** a sonar tile goes in, and a geolocated, confidence-scored contact comes out. Between those two sits a chain of independent steps: preprocessing, detection, confidence filtering, geotagging, then JSON / CSV / GeoJSON output. One function call runs all of it, so the web app, the command line and the edge device all use the same code.

**Why that mattered:**
- The ML, backend and frontend teams could work in parallel because we froze one API contract and one output schema before anyone started building.
- The edge model is exported to ONNX and runs with only onnxruntime, numpy and OpenCV. No PyTorch, no GPU needed. A survey vessel does not want a 4 GB deep-learning install.
- The web stack (Django, Celery, WebSockets, Postgres, Redis) simply calls the same pipeline and pushes partial and final results to the dashboard live.

**The research side:** before choosing anything we reviewed 12 sources on sonar detection, shadow geometry and edge deployment. That review is why we did not chase attention-heavy models or quantization, and it is the "why this and not X" behind our design choices.

My main lesson: write the interface down first. Everything else gets easier.

Repo and architecture docs: link in the first comment.

#SIH2026 #SystemDesign #MachineLearning #EdgeAI #SideScanSonar

Tag: Rehan, Farhan, Faizan

---

## 3. Faiqa: research & physics lead, and the presentation

Sonar does not see objects. It sees shadows. Understanding that is what makes a detector trustworthy.

I led the physics side of our Smart India Hackathon project and built our presentation. Here is the idea that I am most proud of.

**Side-scan sonar builds a picture from sound.** A towfish sends pulses to both sides, and what comes back is an image where a bright highlight is the object and the dark area behind it is its acoustic shadow. The shadow tells you the object's height. Geometrically, height ≈ shadow length × altitude ÷ range, which in the notation we used is h·R / (H − h).

That gives us two checks a plain image detector does not have:
- **Slant-range correction:** raw sonar compresses distance near the centre. Converting slant range to ground range (√(R² − altitude²)) puts objects at their true position on the seabed.
- **Shadow verification:** a real object must cast a shadow consistent with its apparent height. If it does not add up, the detection gets demoted to human review.

**An honest result:** on small 640 px tiles with one assumed geometry, the shadow check could not separate real from false detections. It needs full transects and real per-ping altitude. We built it, tested it, reported the limit, and kept it as an opt-in step for full surveys. I would rather show that than overclaim.

**On the deck:** every slide makes one claim, with one number or one diagram behind it ("Clean the speckle, keep the shadow", "The shadow has to add up"). If a slide needed three ideas, it became three slides.

If you want to understand a sensor, start with its physics. The model comes second.

Link to the repo and docs in the first comment.

#SIH2026 #SideScanSonar #Physics #MarineTech #Presentation

Tag: Rehan, Fareed, Asad

---

## 4. Farhan: backend

Our detector worked perfectly in a notebook. Then it crashed on the first real upload.

I built the backend for DRISHTI at the Smart India Hackathon. The stack: Django REST Framework, Celery workers, Django Channels for WebSockets, Postgres and Redis, all in Docker.

**The flow:** upload an image (optionally with navigation data) → a Celery job runs detect → confidence filter → geotag → results saved to Postgres → the dashboard gets live `detection.partial` and `detection.complete` events over WebSocket. There are endpoints for review (with an audit log of who changed what) and for CSV / GeoJSON export.

**What integration taught us.** Every module passed its own tests. Running them together found real bugs:
- Plain image uploads with no navigation data crashed the whole task, because the geotagging step quit when it had no position source. Fix: return detections with empty coordinates instead.
- A serializer was silently dropping `job_id`, a required contract field.
- Null coordinates broke the GeoJSON export.

**And the Docker build that took 40 minutes** turned out to be a missing `.dockerignore`: the build was copying 38 GB of training data into the image. Adding one file took the image from 30 GB to 1.2 GB and the build from 40 minutes to 2.

Lessons: integrate early, test the unhappy path (no GPS, empty results, bad files), and add a `.dockerignore` on day one.

Repo link in the first comment.

#SIH2026 #Django #BackendDevelopment #Docker #Celery #SideScanSonar

Tag: Rehan, Fareed, Faizan

---

## 5. Faizan: frontend

A detector is only useful if an operator can act on what it finds. That is what the dashboard is for.

I built the DRISHTI frontend for the Smart India Hackathon: React, Vite and Leaflet.

**What an operator can do:**
- **Upload** sonar images, with optional navigation data
- Watch a **live feed** as results stream in over WebSocket, partial results first, then the final set
- See every detection as a **pin on a real map**, using the geotagged coordinates
- Work through a **review queue**: confidence-scored detections that are not auto-confirmed wait for a human to accept or reject them, and every change is logged
- **Export** the results as CSV or GeoJSON for QGIS or Google Earth

**Design choice that mattered:** the pipeline gives every detection a calibrated 0-100 score and a status (auto-confirmed, pending review, dropped). The UI is built around that. The operator's time goes to the uncertain ones, not to everything.

**Working in parallel:** we built against a frozen API contract on a separate branch, with a mock mode in the early days, so I never had to wait for the backend. We merged through pull requests, and lint cleanup before each PR saved us review time.

Interfaces are easy to build once the data contract is clear.

Repo link in the first comment.

#SIH2026 #React #Frontend #Leaflet #UIDesign #SideScanSonar

Tag: Farhan, Rehan

---

## 6. Asad: research & data collection

When we started, there was no ready-made dataset for our problem. So we built one.

I led data collection and research for our Smart India Hackathon project. For side-scan sonar there is no single "ImageNet": the data is scattered across papers, Kaggle, Roboflow and university repositories, in different formats, resolutions and label styles.

**What we assembled:**
- Pipelines: SubPipe
- Shipwrecks: AI4Shipwrecks
- Seabed objects: a Roboflow side-scan set
- Cylinders / mines: a Kaggle sonar mine set

The long sonar strips were tiled to 640 px, labels converted to YOLO format, and empty tiles added as background examples so the model learns what "nothing" looks like.

**The part people skip: licences.** Before publishing anything we audited every source. One source was academic-use-only, so it contributes zero tiles. One class came from a gated source, so we removed it from the public release. Because one source is CC-BY-SA, the whole release is CC-BY-SA-4.0.

**Being honest about the gaps:** no real public dataset exists for ghost nets, so that class is synthetic, built with procedural meshes and acoustic physics, and we label its results that way. The public dataset has 5,205 tiles (about 2 GB).

Lesson: data is most of the project. Budget for it from day one, and check the licence before you publish, not after.

Dataset and code: link in the first comment.

#SIH2026 #DataCollection #OpenData #SideScanSonar #MachineLearning #HuggingFace

Tag: Rehan, Faiqa

---

## Optional: closing post (Rehan, a few days later)

Over the past week each of us shared our piece of DRISHTI. If you missed any, here they are in order: [links to the five posts].

Five things we would tell any team starting a hackathon like this:
1. Check the data before choosing the model.
2. Write your pass/fail bars before you train.
3. Freeze the interface before splitting the team.
4. Integrate end to end early. The bugs are in the gaps between modules.
5. Report the limits yourself. It makes the results more believable.

Thank you to my teammates, and to the people behind the open datasets we built on.

#SIH2026 #SmartIndiaHackathon #Teamwork
